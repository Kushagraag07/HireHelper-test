"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function InterviewOverPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-8">
      <div className="max-w-2xl w-full text-center bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-white/60 p-10">
        <div className="mb-8">
          <div className="w-20 h-20 bg-gradient-to-r from-emerald-400 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
        
        <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-800 bg-clip-text text-transparent mb-4">
          Interview Session Complete
        </h1>
        
        <p className="text-lg text-slate-700 mb-6">
          Thank you for completing your interview. Your session has been successfully recorded and submitted.
        </p>
        
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-8">
          <h3 className="font-semibold text-slate-800 mb-3">What happens next?</h3>
          <div className="text-sm text-slate-600 space-y-2 text-left">
            <div className="flex items-start space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <p>Our team will review your interview responses within 24-48 hours</p>
            </div>
            <div className="flex items-start space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <p>You'll receive an email update on your application status</p>
            </div>
            <div className="flex items-start space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <p>If selected, we'll schedule a follow-up interview</p>
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          
          
          <div className="text-xs text-slate-500">
            All interview resources have been cleaned up and your session is secure.
          </div>
        </div>
      </div>
    </div>
  );
}


