/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged, 
  signOut,
  signInWithPopup,
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  updateDoc, 
  getDocs, 
  getDoc, 
  limit,
  Timestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, googleProvider, storage } from './lib/firebase';
import { cn } from './lib/utils';
import { 
  MessageSquare, 
  Video, 
  Phone, 
  LogOut, 
  Send, 
  User as UserIcon, 
  X, 
  Mic, 
  MicOff, 
  Video as VideoIcon, 
  VideoOff, 
  PhoneOff,
  Search,
  UserPlus,
  Key,
  AtSign,
  Settings,
  Moon,
  Sun,
  Palette,
  Bell,
  Shield,
  HelpCircle,
  Chrome,
  Smile,
  Image as ImageIcon,
  Check,
  CheckCheck,
  Play,
  Pause,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import EmojiPicker, { Theme as EmojiTheme } from 'emoji-picker-react';

// --- Types ---
interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  photoURL: string;
  status: 'online' | 'offline';
  lastActive: any;
  settings?: {
    darkMode: boolean;
    notifications: boolean;
  };
}

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  text?: string;
  voiceUrl?: string;
  stickerUrl?: string;
  status?: 'sent' | 'delivered' | 'seen';
  timestamp: any;
}

interface CallSession {
  id: string;
  callerId: string;
  receiverId: string;
  status: 'ringing' | 'ongoing' | 'ended' | 'missed';
  type: 'video' | 'audio';
  offer?: any;
  answer?: any;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const MessageStatus = ({ status, isMe }: { status?: string, isMe: boolean }) => {
  if (!isMe) return null;
  return (
    <div className="flex items-center ml-1">
      {status === 'seen' ? (
        <CheckCheck size={14} className="text-blue-400" />
      ) : status === 'delivered' ? (
        <CheckCheck size={14} className="text-neutral-400" />
      ) : (
        <Check size={14} className="text-neutral-400" />
      )}
    </div>
  );
};

const VoiceRecorder = ({ onSend }: { onSend: (blob: Blob) => void }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<any>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        onSend(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2">
      {isRecording ? (
        <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-2xl animate-pulse">
          <div className="w-2 h-2 bg-red-500 rounded-full" />
          <span className="text-sm font-mono font-bold text-red-600 dark:text-red-400">{formatTime(recordingTime)}</span>
          <button 
            type="button"
            onClick={stopRecording}
            className="p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      ) : (
        <button 
          type="button"
          onClick={startRecording}
          className="p-3 text-neutral-500 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-2xl transition-colors"
        >
          <Mic size={20} />
        </button>
      )}
    </div>
  );
};

const StickerPicker = ({ onSelect }: { onSelect: (url: string) => void }) => {
  const stickers = [
    "https://api.dicebear.com/7.x/fun-emoji/svg?seed=happy",
    "https://api.dicebear.com/7.x/fun-emoji/svg?seed=cool",
    "https://api.dicebear.com/7.x/fun-emoji/svg?seed=heart",
    "https://api.dicebear.com/7.x/fun-emoji/svg?seed=laugh",
    "https://api.dicebear.com/7.x/fun-emoji/svg?seed=surprised",
    "https://api.dicebear.com/7.x/fun-emoji/svg?seed=wink",
    "https://api.dicebear.com/7.x/fun-emoji/svg?seed=party",
    "https://api.dicebear.com/7.x/fun-emoji/svg?seed=star"
  ];

  return (
    <div className="grid grid-cols-4 gap-2 p-4 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xl max-w-[280px]">
      {stickers.map((url, i) => (
        <button 
          key={i}
          onClick={() => onSelect(url)}
          className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-all hover:scale-110"
        >
          <img src={url} alt="sticker" className="w-12 h-12" />
        </button>
      ))}
    </div>
  );
};

const VoicePlayer = ({ url }: { url: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="flex items-center gap-3 bg-white/10 p-2 rounded-xl min-w-[150px]">
      <button 
        onClick={togglePlay}
        className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
        <div className={cn("h-full bg-white transition-all duration-300", isPlaying ? "w-full" : "w-0")} />
      </div>
      <audio 
        ref={audioRef} 
        src={url} 
        onEnded={() => setIsPlaying(false)}
        className="hidden" 
      />
    </div>
  );
};

// --- Components ---

const Login = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState(''); // This will be the 8-digit ID
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate8DigitId = async () => {
    let id = '';
    let isUnique = false;
    while (!isUnique) {
      id = Math.floor(10000000 + Math.random() * 90000000).toString();
      const docRef = doc(db, 'usernames', id);
      try {
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          isUnique = true;
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'usernames');
      }
    }
    return id;
  };

  const validatePassword = (pass: string) => {
    const isAlphanumeric = /^[a-zA-Z0-9]+$/.test(pass);
    const hasLetter = /[a-zA-Z]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);
    return isAlphanumeric && hasLetter && hasNumber;
  };

  const [isNewUser, setIsNewUser] = useState(false);

  const handleGoogleSignIn = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const u = result.user;
      
      // Check if profile exists
      const userRef = doc(db, 'users', u.uid);
      let userSnap;
      try {
        userSnap = await getDoc(userRef);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'users');
      }
      
      if (userSnap && !userSnap.exists()) {
        const id = await generate8DigitId();
        try {
          await setDoc(doc(db, 'usernames', id), { uid: u.uid });
          await setDoc(userRef, {
            uid: u.uid,
            username: id,
            displayName: u.displayName || `User ${id}`,
            photoURL: u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`,
            status: 'online',
            lastActive: serverTimestamp(),
            settings: { darkMode: false, notifications: true }
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'users/usernames');
        }
        setIsNewUser(true);
      }
    } catch (err: any) {
      console.error("Google Auth error:", err);
      setError(err.message || "Google Sign-In failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing) return;
    setIsProcessing(true);
    setError(null);

    if (isSignUp) {
      if (!validatePassword(password)) {
        setError("Password must contain both letters and numbers.");
        setIsProcessing(false);
        return;
      }

      try {
        const id = await generate8DigitId();
        const email = `${id}@connectify.app`;
        
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const u = userCredential.user;
        
        try {
          await setDoc(doc(db, 'usernames', id), { uid: u.uid });
          await setDoc(doc(db, 'users', u.uid), {
            uid: u.uid,
            username: id,
            displayName: displayName || `User ${id}`,
            photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`,
            status: 'online',
            lastActive: serverTimestamp(),
            settings: { darkMode: false, notifications: true }
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'users/usernames');
        }
        setIsNewUser(true);
      } catch (err: any) {
        console.error("Auth error:", err);
        setError(err.message || "Authentication failed.");
      } finally {
        setIsProcessing(false);
      }
    } else {
      // Sign In
      const cleanId = username.trim();
      if (!cleanId) {
        setError("Please enter your 8-digit Connect ID.");
        setIsProcessing(false);
        return;
      }
      const email = `${cleanId}@connectify.app`;
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (err: any) {
        console.error("Auth error:", err);
        setError("Invalid ID or password.");
      } finally {
        setIsProcessing(false);
      }
    }
  };

  if (isNewUser && auth.currentUser) {
    return (
      <WelcomeModal 
        username={username || "your 8-digit ID"} 
        onDismiss={() => setIsNewUser(false)} 
      />
    );
  }


  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-50 dark:bg-neutral-950 p-4 transition-colors duration-500">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md p-8 bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800"
      >
        <div className="text-center mb-8">
          <div className="mb-4 inline-flex p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-blue-600 dark:text-blue-400">
            <MessageSquare size={40} />
          </div>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">Connectify</h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">{isSignUp ? 'Create your account' : 'Sign in to your account'}</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-100 dark:border-red-900/30">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-5">
          {!isSignUp && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Your 8-Digit Connect ID</label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" size={18} />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="e.g. 12345678"
                  className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-neutral-700 outline-none transition-all text-neutral-900 dark:text-white"
                />
              </div>
            </div>
          )}

          {isSignUp && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Display Name (Optional)</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" size={18} />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Alex Smith"
                  className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-neutral-700 outline-none transition-all text-neutral-900 dark:text-white"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Password</label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" size={18} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-neutral-700 outline-none transition-all text-neutral-900 dark:text-white"
              />
            </div>
            {isSignUp && (
              <p className="mt-1.5 text-[10px] text-neutral-500">Must contain letters and numbers</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isProcessing}
            className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {isProcessing && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="mt-4 flex items-center gap-4">
          <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800" />
          <span className="text-xs text-neutral-400 font-medium">OR</span>
          <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800" />
        </div>

        <button
          onClick={handleGoogleSignIn}
          disabled={isProcessing}
          className="mt-4 w-full py-3.5 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 font-semibold rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all flex items-center justify-center gap-3 shadow-sm"
        >
          <Chrome size={20} className="text-blue-500" />
          Sign in with Google
        </button>

        <div className="mt-8 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-semibold"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const VideoCall = ({ call, currentUser, onEnd }: { call: CallSession, currentUser: FirebaseUser, onEnd: () => void }) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const pc = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const servers = {
    iceServers: [
      { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
    ],
    iceCandidatePoolSize: 10,
  };

  useEffect(() => {
    const startCall = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: call.type === 'video', 
        audio: true 
      });
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      pc.current = new RTCPeerConnection(servers);
      stream.getTracks().forEach(track => pc.current?.addTrack(track, stream));

      pc.current.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
      };

      const callDoc = doc(db, 'calls', call.id);
      const callerCandidates = collection(callDoc, 'callerCandidates');
      const receiverCandidates = collection(callDoc, 'receiverCandidates');

      pc.current.onicecandidate = (event) => {
        if (event.candidate) {
          const targetCollection = currentUser.uid === call.callerId ? callerCandidates : receiverCandidates;
          addDoc(targetCollection, event.candidate.toJSON());
        }
      };

      if (currentUser.uid === call.callerId) {
        const offerDescription = await pc.current.createOffer();
        await pc.current.setLocalDescription(offerDescription);
        await updateDoc(callDoc, { offer: { type: offerDescription.type, sdp: offerDescription.sdp } });

        onSnapshot(callDoc, (snapshot) => {
          const data = snapshot.data();
          if (!pc.current?.currentRemoteDescription && data?.answer) {
            const answerDescription = new RTCSessionDescription(data.answer);
            pc.current?.setRemoteDescription(answerDescription);
          }
        });

        onSnapshot(receiverCandidates, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const candidate = new RTCIceCandidate(change.doc.data());
              pc.current?.addIceCandidate(candidate);
            }
          });
        });
      } else {
        const data = (await getDoc(callDoc)).data();
        if (data?.offer) {
          const offerDescription = new RTCSessionDescription(data.offer);
          await pc.current.setRemoteDescription(offerDescription);
          const answerDescription = await pc.current.createAnswer();
          await pc.current.setLocalDescription(answerDescription);
          await updateDoc(callDoc, { answer: { type: answerDescription.type, sdp: answerDescription.sdp }, status: 'ongoing' });

          onSnapshot(callerCandidates, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'added') {
                const candidate = new RTCIceCandidate(change.doc.data());
                pc.current?.addIceCandidate(candidate);
              }
            });
          });
        }
      }
    };

    startCall();

    return () => {
      localStream?.getTracks().forEach(track => track.stop());
      pc.current?.close();
    };
  }, []);

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks()[0].enabled = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream && call.type === 'video') {
      localStream.getVideoTracks()[0].enabled = !isVideoOff;
      setIsVideoOff(!isVideoOff);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950 flex flex-col items-center justify-center p-4">
      <div className="relative w-full max-w-5xl aspect-video bg-neutral-900 rounded-3xl overflow-hidden shadow-2xl border border-white/5">
        {/* Remote Video */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        
        {/* Local Video Overlay */}
        <motion.div 
          drag
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          className="absolute bottom-6 right-6 w-1/4 aspect-video bg-neutral-800 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl cursor-move z-20"
        >
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        </motion.div>

        {/* Call Info Overlay */}
        <div className="absolute top-6 left-6 flex items-center gap-3 px-4 py-2 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-white text-xs font-medium uppercase tracking-wider">
            {call.type === 'video' ? 'Video Call' : 'Audio Call'} • Ongoing
          </span>
        </div>

        {/* Controls Overlay */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 px-8 py-4 bg-black/40 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl">
          <button
            onClick={toggleMute}
            className={cn(
              "p-4 rounded-2xl transition-all duration-200",
              isMuted ? "bg-red-500 text-white shadow-lg shadow-red-500/40" : "bg-white/10 text-white hover:bg-white/20"
            )}
          >
            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
          </button>
          
          {call.type === 'video' && (
            <button
              onClick={toggleVideo}
              className={cn(
                "p-4 rounded-2xl transition-all duration-200",
                isVideoOff ? "bg-red-500 text-white shadow-lg shadow-red-500/40" : "bg-white/10 text-white hover:bg-white/20"
              )}
            >
              {isVideoOff ? <VideoOff size={24} /> : <VideoIcon size={24} />}
            </button>
          )}

          <div className="w-px h-8 bg-white/10 mx-2" />

          <button
            onClick={onEnd}
            className="p-4 bg-red-600 text-white rounded-2xl hover:bg-red-700 transition-all duration-200 shadow-lg shadow-red-600/40 active:scale-95"
          >
            <PhoneOff size={24} />
          </button>
        </div>
      </div>
      
      <div className="mt-6 text-center">
        <h2 className="text-xl font-semibold text-white">
          {call.type === 'video' ? 'Video Call' : 'Audio Call'}
        </h2>
        <p className="text-neutral-400">Ongoing...</p>
      </div>
    </div>
  );
};

// --- Error Boundary ---
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let message = "Something went wrong.";
      try {
        const errObj = JSON.parse(this.state.error.message);
        message = `Firestore Error: ${errObj.error} during ${errObj.operationType} on ${errObj.path}`;
      } catch (e) {
        message = this.state.error.message || message;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 p-4 text-center">
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-red-200 max-w-md">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Application Error</h2>
            <p className="text-neutral-600 mb-6">{message}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const WelcomeModal = ({ username, onDismiss }: { username: string, onDismiss: () => void }) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 p-8 text-center"
      >
        <div className="mb-6 inline-flex p-4 bg-green-50 dark:bg-green-900/20 rounded-2xl text-green-600 dark:text-green-400">
          <Shield size={40} />
        </div>
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">Welcome to Connectify!</h2>
        <p className="text-neutral-500 dark:text-neutral-400 mb-6">Your account has been created successfully. Here is your unique 8-digit Connect ID:</p>
        
        <div className="bg-neutral-100 dark:bg-neutral-800 p-4 rounded-2xl mb-8 border border-neutral-200 dark:border-neutral-700">
          <span className="text-3xl font-mono font-bold tracking-widest text-blue-600 dark:text-blue-400">{username}</span>
        </div>
        
        <p className="text-xs text-neutral-500 dark:text-neutral-500 mb-8">
          Please save this ID. You will need it to sign in next time.
        </p>
        
        <button 
          onClick={onDismiss}
          className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
        >
          Got it!
        </button>
      </motion.div>
    </motion.div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

function MainApp() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);
  const [searchId, setSearchId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') === 'true';
    }
    return false;
  });
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [remoteIsTyping, setRemoteIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user && currentUserProfile && !localStorage.getItem(`welcome_shown_${user.uid}`)) {
      setIsNewUser(true);
    }
  }, [user, currentUserProfile]);

  const dismissWelcome = () => {
    if (user) {
      localStorage.setItem(`welcome_shown_${user.uid}`, 'true');
    }
    setIsNewUser(false);
  };

  useEffect(() => {
    if (!user || !selectedUser) return;
    const conversationId = [user.uid, selectedUser.uid].sort().join('_');
    const typingRef = doc(db, 'typing', `${conversationId}_${user.uid}`);
    
    if (newMessage.trim()) {
      setDoc(typingRef, { 
        conversationId, 
        userId: user.uid, 
        isTyping: true, 
        lastUpdate: serverTimestamp() 
      }, { merge: true }).catch(err => console.error("Typing error:", err));
    } else {
      setDoc(typingRef, { 
        isTyping: false, 
        lastUpdate: serverTimestamp() 
      }, { merge: true }).catch(err => console.error("Typing error:", err));
    }

    const timeout = setTimeout(() => {
      setDoc(typingRef, { 
        isTyping: false, 
        lastUpdate: serverTimestamp() 
      }, { merge: true }).catch(err => console.error("Typing error:", err));
    }, 3000);

    return () => clearTimeout(timeout);
  }, [newMessage, user, selectedUser]);

  useEffect(() => {
    if (!user || !selectedUser) {
      setRemoteIsTyping(false);
      return;
    }
    const conversationId = [user.uid, selectedUser.uid].sort().join('_');
    const remoteTypingRef = doc(db, 'typing', `${conversationId}_${selectedUser.uid}`);
    
    const unsub = onSnapshot(remoteTypingRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        // Only show typing if it was updated recently (within 10 seconds)
        const lastUpdate = data.lastUpdate?.toDate();
        const now = new Date();
        if (data.isTyping && lastUpdate && (now.getTime() - lastUpdate.getTime() < 10000)) {
          setRemoteIsTyping(true);
        } else {
          setRemoteIsTyping(false);
        }
      } else {
        setRemoteIsTyping(false);
      }
    });
    return () => unsub();
  }, [user, selectedUser]);

  useEffect(() => {
    if (!user || !selectedUser || messages.length === 0) return;
    
    const unseenMessages = messages.filter(m => m.receiverId === user.uid && m.status !== 'seen');
    unseenMessages.forEach(m => {
      updateDoc(doc(db, 'messages', m.id), { status: 'seen' }).catch(err => console.error("Error marking as seen:", err));
    });
  }, [messages, user, selectedUser]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', darkMode.toString());
  }, [darkMode]);

  useEffect(() => {
    // Test Firestore connection
    const testConnection = async () => {
      try {
        const { getDocFromServer } = await import('firebase/firestore');
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        // Update user profile status
        const userRef = doc(db, 'users', u.uid);
        try {
          await updateDoc(userRef, {
            status: 'online',
            lastActive: serverTimestamp()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `users/${u.uid}`);
        }

        // Listen to current user profile
        const unsubProfile = onSnapshot(userRef, (doc) => {
          if (doc.exists()) {
            const profile = doc.data() as UserProfile;
            setCurrentUserProfile(profile);
            if (profile.settings?.darkMode !== undefined) {
              setDarkMode(profile.settings.darkMode);
            }
          }
        });
        return () => unsubProfile();
      } else {
        setCurrentUserProfile(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Listen for users (only those we've interacted with or found)
    // For simplicity in this ID-based app, we'll show all users for now, 
    // but in a real app you'd only show "contacts"
    const usersQuery = query(collection(db, 'users'), where('uid', '!=', user.uid));
    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      const usersList = snapshot.docs.map(doc => doc.data() as UserProfile);
      setUsers(usersList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    // Listen for incoming calls
    const callsQuery = query(
      collection(db, 'calls'), 
      where('participants', 'array-contains', user.uid), 
      where('status', '==', 'ringing')
    );
    const unsubscribeCalls = onSnapshot(callsQuery, (snapshot) => {
      // Filter for calls where we are the receiver
      const incoming = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as CallSession))
        .find(c => c.receiverId === user.uid);
      
      if (incoming) {
        setIncomingCall(incoming);
      } else {
        setIncomingCall(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'calls');
    });

    return () => {
      unsubscribeUsers();
      unsubscribeCalls();
    };
  }, [user]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = searchId.trim();
    if (!cleanId || isSearching) return;

    setIsSearching(true);
    setSearchError(null);

    try {
      const q = query(collection(db, 'users'), where('username', '==', cleanId), limit(1));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        setSearchError("User not found.");
      } else {
        const foundUser = snapshot.docs[0].data() as UserProfile;
        if (foundUser.uid === user?.uid) {
          setSearchError("That's you!");
        } else {
          setSelectedUser(foundUser);
          setSearchId('');
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users');
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (!user || !selectedUser) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, 'messages'),
      where('participants', 'array-contains', user.uid),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Message))
        .filter(m => 
          (m.senderId === user.uid && m.receiverId === selectedUser.uid) ||
          (m.senderId === selectedUser.uid && m.receiverId === user.uid)
        );
      setMessages(msgs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'messages');
    });

    return () => unsubscribe();
  }, [user, selectedUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedUser || !newMessage.trim()) return;

    try {
      await addDoc(collection(db, 'messages'), {
        senderId: user.uid,
        receiverId: selectedUser.uid,
        text: newMessage.trim(),
        timestamp: serverTimestamp(),
        participants: [user.uid, selectedUser.uid],
        status: 'sent'
      });
      setNewMessage('');
      setShowEmojiPicker(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'messages');
    }
  };

  const handleSendVoice = async (blob: Blob) => {
    if (!user || !selectedUser) return;
    try {
      const fileName = `voice_${Date.now()}.webm`;
      const storageRef = ref(storage, `voice_messages/${user.uid}/${fileName}`);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);

      await addDoc(collection(db, 'messages'), {
        senderId: user.uid,
        receiverId: selectedUser.uid,
        voiceUrl: url,
        timestamp: serverTimestamp(),
        participants: [user.uid, selectedUser.uid],
        status: 'sent'
      });
    } catch (error) {
      console.error("Error sending voice message:", error);
    }
  };

  const handleSendSticker = async (url: string) => {
    if (!user || !selectedUser) return;
    try {
      await addDoc(collection(db, 'messages'), {
        senderId: user.uid,
        receiverId: selectedUser.uid,
        stickerUrl: url,
        timestamp: serverTimestamp(),
        participants: [user.uid, selectedUser.uid],
        status: 'sent'
      });
      setShowStickerPicker(false);
    } catch (error) {
      console.error("Error sending sticker:", error);
    }
  };

  const startCall = async (type: 'video' | 'audio') => {
    if (!user || !selectedUser) return;

    try {
      const callData = {
        callerId: user.uid,
        receiverId: selectedUser.uid,
        status: 'ringing',
        type,
        timestamp: serverTimestamp(),
        participants: [user.uid, selectedUser.uid]
      };

      const docRef = await addDoc(collection(db, 'calls'), callData);
      setActiveCall({ id: docRef.id, ...callData } as CallSession);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'calls');
    }
  };

  const acceptCall = async () => {
    if (!incomingCall) return;
    try {
      await updateDoc(doc(db, 'calls', incomingCall.id), { status: 'ongoing' });
      setActiveCall(incomingCall);
      setIncomingCall(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `calls/${incomingCall.id}`);
    }
  };

  const rejectCall = async () => {
    if (!incomingCall) return;
    try {
      await updateDoc(doc(db, 'calls', incomingCall.id), { status: 'missed' });
      setIncomingCall(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `calls/${incomingCall.id}`);
    }
  };

  const endCall = async () => {
    if (!activeCall) return;
    try {
      await updateDoc(doc(db, 'calls', activeCall.id), { status: 'ended' });
      setActiveCall(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `calls/${activeCall.id}`);
    }
  };

  const SettingsModal = () => {
    const [newDisplayName, setNewDisplayName] = useState(currentUserProfile?.displayName || '');
    const [newPhotoURL, setNewPhotoURL] = useState(currentUserProfile?.photoURL || '');
    const [isSaving, setIsSaving] = useState(false);

    const handleSaveSettings = async () => {
      if (!user) return;
      setIsSaving(true);
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          displayName: newDisplayName,
          photoURL: newPhotoURL,
          settings: {
            darkMode,
            notifications: currentUserProfile?.settings?.notifications ?? true
          }
        });
        setIsSettingsOpen(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      } finally {
        setIsSaving(false);
      }
    };

    return (
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setIsSettingsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-800/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                    <Settings size={20} />
                  </div>
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Settings</h2>
                </div>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-full transition-colors text-neutral-500"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                {/* Profile Section */}
                <section className="space-y-4">
                  <h3 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                    <UserIcon size={14} /> Profile
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Display Name</label>
                      <input 
                        type="text" 
                        value={newDisplayName}
                        onChange={(e) => setNewDisplayName(e.target.value)}
                        className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-neutral-900 dark:text-white transition-all"
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Avatar URL</label>
                      <input 
                        type="text" 
                        value={newPhotoURL}
                        onChange={(e) => setNewPhotoURL(e.target.value)}
                        className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-neutral-900 dark:text-white transition-all"
                        placeholder="https://..."
                      />
                      <p className="mt-1 text-[10px] text-neutral-500">Tip: Use Dicebear or any image URL</p>
                    </div>
                  </div>
                </section>

                {/* Appearance Section */}
                <section className="space-y-4">
                  <h3 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                    <Palette size={14} /> Appearance
                  </h3>
                  <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        darkMode ? "bg-indigo-500/20 text-indigo-400" : "bg-orange-100 text-orange-600"
                      )}>
                        {darkMode ? <Moon size={18} /> : <Sun size={18} />}
                      </div>
                      <div>
                        <p className="font-medium text-neutral-900 dark:text-white">Dark Mode</p>
                        <p className="text-xs text-neutral-500">Easier on your eyes</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setDarkMode(!darkMode)}
                      className={cn(
                        "w-12 h-6 rounded-full relative transition-colors duration-200 outline-none",
                        darkMode ? "bg-blue-600" : "bg-neutral-300"
                      )}
                    >
                      <motion.div 
                        animate={{ x: darkMode ? 26 : 2 }}
                        className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-sm"
                      />
                    </button>
                  </div>
                </section>

                {/* Other Sections (Placeholders) */}
                <section className="space-y-2">
                  <button className="w-full flex items-center justify-between p-3 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl transition-colors text-neutral-700 dark:text-neutral-300">
                    <div className="flex items-center gap-3">
                      <Bell size={18} className="text-neutral-400" />
                      <span className="text-sm font-medium">Notifications</span>
                    </div>
                    <HelpCircle size={14} className="text-neutral-400" />
                  </button>
                  <button className="w-full flex items-center justify-between p-3 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl transition-colors text-neutral-700 dark:text-neutral-300">
                    <div className="flex items-center gap-3">
                      <Shield size={18} className="text-neutral-400" />
                      <span className="text-sm font-medium">Privacy & Security</span>
                    </div>
                    <HelpCircle size={14} className="text-neutral-400" />
                  </button>
                </section>
              </div>

              <div className="p-6 bg-neutral-50 dark:bg-neutral-800/50 border-t border-neutral-100 dark:border-neutral-800 flex gap-3">
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveSettings}
                  disabled={isSaving}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20 transition-all"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50 dark:bg-neutral-950 transition-colors duration-500">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 animate-pulse">Loading Connectify...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="flex h-screen bg-neutral-100 dark:bg-neutral-950 overflow-hidden text-neutral-900 dark:text-neutral-100">
      <AnimatePresence>
        {isNewUser && currentUserProfile && (
          <WelcomeModal 
            username={currentUserProfile.username} 
            onDismiss={dismissWelcome} 
          />
        )}
      </AnimatePresence>
      <SettingsModal />
      {/* Sidebar */}
      <div className="w-80 flex flex-col bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800">
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <MessageSquare size={24} />
              </div>
              <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Chats</h1>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 text-neutral-500 dark:text-neutral-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                title="Settings"
              >
                <Settings size={20} />
              </button>
              <button 
                onClick={() => signOut(auth)}
                className="p-2 text-neutral-500 dark:text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>

          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
            <input
              type="text"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="Search by ID..."
              className="w-full pl-10 pr-4 py-2 bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-neutral-700 outline-none text-sm text-neutral-900 dark:text-white"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </form>
          {searchError && (
            <p className="mt-2 text-xs text-red-500 px-1">{searchError}</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-neutral-200 dark:scrollbar-thumb-neutral-800">
          {users.map(u => (
            <button
              key={u.uid}
              onClick={() => setSelectedUser(u)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
                selectedUser?.uid === u.uid 
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 ring-1 ring-blue-100 dark:ring-blue-900/30" 
                  : "hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
              )}
            >
              <div className="relative">
                {u.photoURL ? (
                  <img src={u.photoURL} alt={u.displayName} className="w-12 h-12 rounded-full object-cover border border-neutral-100 dark:border-neutral-800" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-neutral-500 dark:text-neutral-400">
                    <UserIcon size={24} />
                  </div>
                )}
                <div className={cn(
                  "absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-neutral-900",
                  u.status === 'online' ? "bg-green-500" : "bg-neutral-400"
                )} />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="font-semibold truncate dark:text-white">{u.displayName}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">@{u.username}</p>
              </div>
            </button>
          ))}
          {users.length === 0 && (
            <div className="text-center py-12 text-neutral-400 dark:text-neutral-600">
              <p>No other users online</p>
            </div>
          )}
        </div>

        <div className="p-4 bg-neutral-50 dark:bg-neutral-800/30 border-t border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            {currentUserProfile?.photoURL ? (
              <img src={currentUserProfile.photoURL} alt={currentUserProfile.displayName} className="w-10 h-10 rounded-full border border-neutral-200 dark:border-neutral-700" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-neutral-500 dark:text-neutral-400">
                <UserIcon size={20} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">{currentUserProfile?.displayName || 'Me'}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">@{currentUserProfile?.username}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white dark:bg-neutral-950">
        {selectedUser ? (
          <>
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="relative">
                  {selectedUser.photoURL ? (
                    <img src={selectedUser.photoURL} alt={selectedUser.displayName} className="w-10 h-10 rounded-full border border-neutral-100 dark:border-neutral-800 object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-neutral-500 dark:text-neutral-400">
                      <UserIcon size={20} />
                    </div>
                  )}
                  {selectedUser.status === 'online' && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-neutral-950 rounded-full" />
                  )}
                </div>
                <div>
                  <h2 className="font-bold text-neutral-900 dark:text-white leading-tight">{selectedUser.displayName}</h2>
                  <div className="flex items-center gap-2">
                    {remoteIsTyping ? (
                      <span className="text-[10px] font-medium text-blue-500 animate-pulse uppercase tracking-wider">typing...</span>
                    ) : (
                      <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium uppercase tracking-wider">
                        {selectedUser.status === 'online' ? 'Online' : selectedUser.lastActive ? `Last seen ${new Date(selectedUser.lastActive.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Offline'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => startCall('audio')}
                  className="p-2 text-neutral-500 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                >
                  <Phone size={20} />
                </button>
                <button 
                  onClick={() => startCall('video')}
                  className="p-2 text-neutral-500 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                >
                  <Video size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-neutral-50/50 dark:bg-neutral-900/20 scrollbar-thin scrollbar-thumb-neutral-200 dark:scrollbar-thumb-neutral-800">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col max-w-[85%]",
                    msg.senderId === user.uid ? "ml-auto items-end" : "mr-auto items-start"
                  )}
                >
                  <div
                    className={cn(
                      "px-4 py-2.5 rounded-2xl text-sm shadow-sm relative group",
                      msg.senderId === user.uid 
                        ? "bg-blue-600 text-white rounded-tr-none" 
                        : "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-tl-none border border-neutral-100 dark:border-neutral-700"
                    )}
                  >
                    {msg.stickerUrl ? (
                      <img src={msg.stickerUrl} alt="sticker" className="w-24 h-24" />
                    ) : msg.voiceUrl ? (
                      <VoicePlayer url={msg.voiceUrl} />
                    ) : (
                      msg.text
                    )}
                    <div className="flex items-center justify-end gap-1 mt-1 opacity-70">
                      <span className="text-[9px]">
                        {msg.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <MessageStatus status={msg.status} isMe={msg.senderId === user.uid} />
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-white dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 relative">
              <AnimatePresence>
                {showEmojiPicker && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="absolute bottom-full right-4 mb-4 z-50"
                  >
                    <EmojiPicker 
                      onEmojiClick={(emoji) => setNewMessage(prev => prev + emoji.emoji)}
                      theme={darkMode ? EmojiTheme.DARK : EmojiTheme.LIGHT}
                    />
                  </motion.div>
                )}
                {showStickerPicker && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="absolute bottom-full left-4 mb-4 z-50"
                  >
                    <StickerPicker onSelect={handleSendSticker} />
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSendMessage} className="flex items-center gap-2 max-w-4xl mx-auto">
                <div className="flex items-center gap-1">
                  <button 
                    type="button"
                    onClick={() => {
                      setShowStickerPicker(!showStickerPicker);
                      setShowEmojiPicker(false);
                    }}
                    className={cn(
                      "p-3 rounded-2xl transition-colors",
                      showStickerPicker ? "bg-blue-100 text-blue-600" : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    )}
                  >
                    <ImageIcon size={20} />
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setShowEmojiPicker(!showEmojiPicker);
                      setShowStickerPicker(false);
                    }}
                    className={cn(
                      "p-3 rounded-2xl transition-colors",
                      showEmojiPicker ? "bg-blue-100 text-blue-600" : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    )}
                  >
                    <Smile size={20} />
                  </button>
                </div>

                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-3 bg-neutral-100 dark:bg-neutral-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-neutral-700 transition-all outline-none text-sm text-neutral-900 dark:text-white"
                />

                <VoiceRecorder onSend={handleSendVoice} />

                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="p-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-600/20"
                >
                  <Send size={20} />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-neutral-50/30 dark:bg-neutral-900/10">
            <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-3xl flex items-center justify-center text-blue-600 dark:text-blue-400 mb-6 animate-pulse">
              <MessageSquare size={40} />
            </div>
            <h3 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">Welcome to Connectify</h3>
            <p className="text-neutral-500 dark:text-neutral-400 max-w-xs">
              Search for a Connect ID to start chatting and calling with your friends.
            </p>
          </div>
        )}
      </div>

      {/* Incoming Call Overlay */}
      <AnimatePresence>
        {incomingCall && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <div className="bg-white dark:bg-neutral-900 rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl border border-white/20 dark:border-neutral-800">
              <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600 dark:text-blue-400 animate-pulse">
                {incomingCall.type === 'video' ? <Video size={40} /> : <Phone size={40} />}
              </div>
              <h3 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">Incoming Call</h3>
              <p className="text-neutral-500 dark:text-neutral-400 mb-8">
                {users.find(u => u.uid === incomingCall.callerId)?.displayName || 'Someone'} is calling you...
              </p>
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={rejectCall}
                  className="flex-1 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-semibold rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors flex items-center justify-center gap-2"
                >
                  <X size={20} /> Decline
                </button>
                <button
                  onClick={acceptCall}
                  className="flex-1 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-green-600/20"
                >
                  <Phone size={20} /> Accept
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Call Overlay */}
      {activeCall && (
        <VideoCall 
          call={activeCall} 
          currentUser={user} 
          onEnd={endCall} 
        />
      )}
    </div>
  );
}
