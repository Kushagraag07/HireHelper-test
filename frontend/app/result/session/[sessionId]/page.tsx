// app/dashboard/result/session/[sessionId]/page.tsx
'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

type HistoryItem = {
  question_number: number
  question:        string
  answer:          string
  score?:          number
  stage?:          string
  timestamp:       string
}

type Session = {
  average_score?:   number
  summary?:         string
  recommendation?:  string
  history?:         HistoryItem[]
}

const ScoreGauge = ({ score }: { score: number }) => {
  const percentage = (score / 10) * 100
  const circumference = 2 * Math.PI * 45
  const strokeDasharray = circumference
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600'
    if (score >= 6) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getStrokeColor = (score: number) => {
    if (score >= 8) return 'stroke-green-500'
    if (score >= 6) return 'stroke-yellow-500'
    return 'stroke-red-500'
  }

  return (
    <div className="relative flex items-center justify-center">
      <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="45"
          stroke="rgb(229, 231, 235)"
          strokeWidth="8"
          fill="none"
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          className={getStrokeColor(score)}
          strokeWidth="8"
          fill="none"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className={`text-3xl font-bold ${getScoreColor(score)}`}>
            {score.toFixed(1)}
          </div>
          <div className="text-sm text-gray-500">out of 10</div>
        </div>
      </div>
    </div>
  )
}

const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
)

const ScoreBadge = ({ score }: { score?: number }) => {
  if (!score) return <span className="text-gray-400">N/A</span>
  
  const getScoreStyle = (score: number) => {
    if (score >= 8) return 'bg-green-100 text-green-800 border-green-200'
    if (score >= 6) return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    return 'bg-red-100 text-red-800 border-red-200'
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getScoreStyle(score)}`}>
      {score.toFixed(1)}/10
    </span>
  )
}

export default function InterviewSummaryPage() {
  const { sessionId } = useParams() as { sessionId: string }
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL

  useEffect(() => {
    if (!sessionId) return
    fetch(`${API_BASE}/session/${sessionId}`, {
      credentials: 'include'
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load session')
        return res.json()
      })
      .then(data => {
        setSession(data.session)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setError(err.message)
        setLoading(false)
      })
  }, [sessionId, API_BASE])

  const toggleExpanded = (index: number) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedItems(newExpanded)
  }

  if (loading) return <LoadingSpinner />
  
  if (error || !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-6">{error || 'Session not found'}</p>
          <button
            onClick={() => router.back()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mb-4"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Interview Summary</h1>
          <p className="text-gray-600 mt-2">Session ID: {sessionId}</p>
        </div>

        {/* Score Overview */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Overall Performance</h2>
              <p className="text-gray-600">Your interview performance summary</p>
            </div>
            <div className="flex-shrink-0">
              {session.average_score ? (
                <ScoreGauge score={session.average_score} />
              ) : (
                <div className="w-32 h-32 bg-gray-100 rounded-full flex items-center justify-center">
                  <span className="text-gray-500">No Score</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Recommendation */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Recommendation</h3>
            </div>
            <div className="prose prose-sm max-w-none">
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {session.recommendation ?? 'No recommendation available.'}
              </p>
            </div>
          </div>

          {/* Strengths & Growth Areas */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Strengths & Growth Areas</h3>
            </div>
            <div className="prose prose-sm max-w-none">
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {session.summary ?? 'No summary available.'}
              </p>
            </div>
          </div>
        </div>

        {/* Conversation History */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-6">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Full Conversation</h3>
          </div>
          
          {session.history && session.history.length > 0 ? (
            <div className="space-y-4">
              {session.history.map((h, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div 
                    className="p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => toggleExpanded(idx)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Q{h.question_number}
                          </span>
                          {h.stage && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {h.stage}
                            </span>
                          )}
                          <ScoreBadge score={h.score} />
                        </div>
                        <p className="font-medium text-gray-900 line-clamp-2">
                          {h.question}
                        </p>
                      </div>
                      <svg 
                        className={`w-5 h-5 text-gray-400 transition-transform ${expandedItems.has(idx) ? 'rotate-180' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  
                  {expandedItems.has(idx) && (
                    <div className="p-4 bg-white border-t border-gray-200">
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">Question:</h4>
                          <p className="text-gray-700">{h.question}</p>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">Your Answer:</h4>
                          <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">{h.answer}</p>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>Score: {h.score ?? 'N/A'}</span>
                          <span>•</span>
                          <span>Stage: {h.stage ?? 'N/A'}</span>
                          <span>•</span>
                          <span>{new Date(h.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-400 text-5xl mb-4">💬</div>
              <p className="text-gray-600">No conversation history available.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}