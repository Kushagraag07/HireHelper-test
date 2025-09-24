import React, { useState } from 'react'
import { Job } from '@/types/types'
import {
  FileText,
  Users,
  Calendar,
  Star,
  Plus,
  Search,
  Filter
} from 'lucide-react'

// interface Job {
//   jobId: string
//   description: string
//   createdAt: string
//   scoredResumes: Array<{
//     name: string
//     email: string
//     filename: string
//     score: number
//   }>
// }

interface JobsGridProps {
  jobs: Job[]
  user: { name: string }
  loading: boolean
  onJobSelect: (job: Job) => void
  onNewJobClick: () => void
}

const JobsGrid: React.FC<JobsGridProps> = ({ 
  jobs, 
  user, 
  loading, 
  onJobSelect, 
  onNewJobClick 
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [jobTitle, setJobTitle] = useState('')
  const [jobType, setJobType] = useState('')
  const [duration, setDuration] = useState('')
  const [skillsRequired, setSkillsRequired] = useState('')
  const [experienceRequired, setExperienceRequired] = useState('')
  const [basicRequirements, setBasicRequirements] = useState('')
  const [additionalNotes, setAdditionalNotes] = useState('')

  const filteredJobs = jobs.filter(job =>
    job.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">HireHelper</h1>
                <p className="text-sm text-gray-500">Welcome, {user.name}</p>
              </div>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>New Job</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center space-x-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search job descriptions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <Filter className="w-4 h-4" />
            <span>Filter</span>
          </button>
        </div>

        {/* Jobs Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredJobs.map((job) => (
              <div
                key={job.jobId}
                className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => onJobSelect(job)}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <span className="text-sm font-medium text-gray-900">Job Description</span>
                    </div>
                    <div className="flex items-center space-x-1 text-sm text-gray-500">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(job.createdAt)}</span>
                    </div>
                  </div>
                  
                  <p className="text-gray-700 text-sm mb-4 line-clamp-3">
                    {job.description}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{job.scoredResumes.length} resumes</span>
                      </div>
                      {job.scoredResumes.length > 0 && (
                        <div className="flex items-center space-x-1">
                          <Star className="w-4 h-4 text-yellow-500" />
                          <span className="text-sm text-gray-600">
                            {(job.scoredResumes.reduce((sum, r) => sum + r.score, 0) / job.scoredResumes.length).toFixed(1)}
                          </span>
                        </div>
                      )}
                    </div>
                    <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                      View Details →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filteredJobs.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs found</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm ? 'No jobs match your search criteria.' : 'Get started by creating your first job posting.'}
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
            >
              Create New Job
            </button>
          </div>
        )}
      </div>

      {/* Create New Job Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCreate(false)} />
          <div className="relative bg-white w-full max-w-2xl rounded-lg shadow-xl border border-gray-200 p-6 mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Create New Job</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="grid grid-cols-1 gap-4 max-h-[70vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Title *</label>
                <input value={jobTitle} onChange={e => setJobTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="e.g., Senior Software Engineer" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Type *</label>
                <select value={jobType} onChange={e => setJobType(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option value="">Select job type</option>
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                  <option value="Internship">Internship</option>
                  <option value="Freelance">Freelance</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                <input value={duration} onChange={e => setDuration(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="e.g., 6 months, Permanent, etc." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Skills Required *</label>
                <textarea value={skillsRequired} onChange={e => setSkillsRequired(e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="e.g., JavaScript, React, Node.js, Python, SQL" />
                <p className="text-xs text-gray-500 mt-1">Separate skills with commas</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Experience Required *</label>
                <input value={experienceRequired} onChange={e => setExperienceRequired(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="e.g., 3-5 years, Entry level, Senior level" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Basic Requirements *</label>
                <textarea value={basicRequirements} onChange={e => setBasicRequirements(e.target.value)} rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="• Bachelor's degree in Computer Science or related field\n• Strong problem-solving skills\n• Excellent communication abilities\n• Team collaboration experience" />
                <p className="text-xs text-gray-500 mt-1">Use bullet points (•) for better formatting</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
                <textarea value={additionalNotes} onChange={e => setAdditionalNotes(e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Any additional information about the role, company culture, benefits, etc." />
              </div>
              {/* Preview */}
              {(jobTitle || jobType || skillsRequired || experienceRequired || basicRequirements) && (
                <div className="bg-gray-50 p-3 rounded border">
                  <h4 className="font-medium text-gray-900 mb-2">Job Description Preview</h4>
                  <pre className="whitespace-pre-wrap text-sm text-gray-700">{`Job Title: ${jobTitle}
Job Type: ${jobType}
Duration: ${duration}
Skills Required: ${skillsRequired}
Experience Required: ${experienceRequired}
Basic Requirements: ${basicRequirements}
${additionalNotes ? `\nAdditional Notes: ${additionalNotes}` : ''}`}</pre>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-end space-x-3">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => {
                  if (!jobTitle || !jobType || !skillsRequired || !experienceRequired || !basicRequirements) {
                    alert('Please fill in all required fields (*)')
                    return
                  }
                  const description = `Job Title: ${jobTitle}\nJob Type: ${jobType}\nDuration: ${duration}\nSkills Required: ${skillsRequired}\nExperience Required: ${experienceRequired}\nBasic Requirements: ${basicRequirements}\n${additionalNotes ? `\nAdditional Notes: ${additionalNotes}` : ''}`
                  const draft = { jobTitle, jobType, duration, skillsRequired, experienceRequired, basicRequirements, additionalNotes, description }
                  try { localStorage.setItem('draftJobForm', JSON.stringify(draft)) } catch {}
                  setShowCreate(false)
                  onNewJobClick()
                }}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default JobsGrid