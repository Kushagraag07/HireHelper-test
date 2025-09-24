// src/types.ts
export interface Resume {
    resumeId:       string
    name:           string
    email:          string
    filename:       string
    score:          number
    feedback?:      string
    interviewDone?: boolean
    sessionId?:     string
  }
  
  export interface Job {
    jobId:         string
    description:   string
    createdAt:     string
    scoredResumes: Resume[]
  }
  