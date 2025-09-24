# HireHelper - AI-Powered HR Interview Platform adaadaa dadada

## 🚀 Overview

HireHelper is a comprehensive AI-powered recruitment platform that revolutionizes the hiring process through intelligent resume analysis, automated interviews, and advanced candidate evaluation. The platform combines cutting-edge AI technologies to streamline every step of the recruitment workflow.

## ✨ Key Features

### 🤖 AI-Powered Resume Analysis
- **Smart JD Parsing**: Automatically extracts job requirements, skills, and qualifications from job descriptions
- **Resume Matching**: AI-powered scoring system that matches candidates to job requirements with precision
- **Vector Database**: Uses Qdrant vector database for semantic search and similarity matching
- **PDF Processing**: Advanced PDF parsing with email extraction and text analysis

### 🎥 Automated AI Interviews
- **Natural Conversation Flow**: AI conducts professional interviews with contextual follow-up questions
- **Voice Recognition**: Real-time speech-to-text using Deepgram for seamless voice interaction
- **Proctoring System**: Advanced monitoring with eye-tracking, tab-switch detection, and object recognition
- **Video Recording**: Dual camera and screen recording for comprehensive interview documentation

### 📊 Comprehensive Analytics
- **Real-time Scoring**: Instant candidate evaluation with detailed feedback
- **Performance Metrics**: Track hiring metrics, interview performance, and candidate progress
- **Automated Reports**: Detailed analysis reports delivered via email
- **Dashboard Analytics**: Visual representation of hiring statistics and trends

### 🔐 Enterprise Security
- **JWT Authentication**: Secure user authentication with refresh tokens
- **GDPR Compliance**: Enterprise-grade security with encrypted data handling
- **Role-based Access**: Secure access control for recruiters and administrators

## 🏗️ Architecture

### Backend (FastAPI + Python)
- **FastAPI**: High-performance web framework for building APIs
- **MongoDB**: Document database for storing job profiles, resumes, and user data
- **Qdrant**: Vector database for semantic search and similarity matching
- **Google Generative AI**: For embeddings and intelligent text processing
- **OpenAI**: Advanced language models for interview questions and scoring
- **WebSocket**: Real-time communication for live interviews

### Frontend (Next.js + React)
- **Next.js 15**: React framework with server-side rendering
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **TensorFlow.js**: Client-side object detection for proctoring
- **WebGazer**: Eye-tracking for interview monitoring
- **Deepgram**: Real-time speech recognition

## 🛠️ Technology Stack

### Backend Dependencies
```
fastapi
uvicorn
python-dotenv
langchain-google-genai
langchain-community
langchain-core
langchain
python-jose[cryptography]
pymongo
bcrypt
fastapi-mail
pydantic
python-multipart
PyMuPDF
motor
pinecone-client
qdrant_client
langchain_qdrant
pypdf
openai
```

### Frontend Dependencies
```
next: 15.3.5
react: ^19.0.0
typescript: ^5
@deepgram/sdk: ^4.9.1
@tensorflow/tfjs: 3.21.0
@tensorflow-models/coco-ssd: 2.2.2
webgazer: ^3.3.0
lucide-react: ^0.525.0
tailwindcss: ^4
```

## 🚀 Getting Started

### Prerequisites

1. **Python 3.11+** - Backend runtime
2. **Node.js 18+** - Frontend runtime
3. **MongoDB** - Database (local or cloud)
4. **Qdrant** - Vector database (local or cloud)
5. **API Keys** - Various AI services (see Environment Variables)

### Installation

#### 1. Clone the Repository
```bash
git clone <repository-url>
cd hr-agent-master
```

#### 2. Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

#### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install
# or
pnpm install
```

### Environment Variables

Create `.env` files in both `backend/` and `frontend/` directories:

#### Backend Environment Variables (`backend/.env`)

```env
# Database Configuration
MONGODB_URL=mongodb://localhost:27017
AUTH_DB_NAME=auth_db
APP_DB_NAME=app_db

# Vector Database
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your_qdrant_api_key
QDRANT_COLLECTION=resumes

# AI Services
GOOGLE_API_KEY=your_google_generative_ai_key
OPENAI_API_KEY=your_openai_api_key

# Email Service (Mailjet)
MAILJET_API_KEY=your_mailjet_api_key
MAILJET_SECRET_KEY=your_mailjet_secret_key
MAILJET_SENDER_EMAIL=your_verified_email@domain.com

# Speech Recognition
DEEPGRAM_API_KEY=your_deepgram_api_key

# Security
SECRET_KEY=your_secret_key_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Cookie Settings (for production)
COOKIE_SECURE=false
COOKIE_SAMESITE=Lax
```

#### Frontend Environment Variables (`frontend/.env.local`)

```env
# API Configuration
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

# Deepgram Configuration
NEXT_PUBLIC_DEEPGRAM_API_KEY=your_deepgram_api_key
```

### Running the Application

#### 1. Start Backend Server
```bash
cd backend

# Activate virtual environment
venv\Scripts\activate  # Windows
# source venv/bin/activate  # macOS/Linux

# Start the server
python app.py
# or
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at `http://localhost:8000`

#### 2. Start Frontend Development Server
```bash
cd frontend

# Start development server
npm run dev
# or
pnpm dev
```

The frontend will be available at `http://localhost:3000`

## 📋 API Endpoints

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - User logout

### Jobs & Resumes
- `POST /jobs` - Create new job with resume uploads
- `GET /jobs` - Get all jobs for current user
- `GET /jobs/{job_id}` - Get specific job with scored resumes
- `POST /jobs/{job_id}/resumes` - Add more resumes to existing job

### Interviews
- `POST /schedule-interview` - Schedule interview sessions
- `POST /send-invites` - Send interview invitations via email
- `WS /ws/interview/{job_id}/{resume_id}` - WebSocket for live interviews

### Email
- `POST /send-invites` - Send interview invitations
- `POST /send-results` - Send interview results and reports

## 🔧 Configuration

### Database Setup

#### MongoDB
1. Install MongoDB locally or use MongoDB Atlas
2. Create databases: `auth_db` and `app_db`
3. Update `MONGODB_URL` in environment variables

#### Qdrant Vector Database
1. Install Qdrant locally or use Qdrant Cloud
2. Create collection named `resumes`
3. Update `QDRANT_URL` and `QDRANT_API_KEY` in environment variables

### AI Services Setup

#### Google Generative AI
1. Get API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Update `GOOGLE_API_KEY` in environment variables

#### OpenAI
1. Get API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Update `OPENAI_API_KEY` in environment variables

#### Deepgram
1. Get API key from [Deepgram Console](https://console.deepgram.com/)
2. Update `DEEPGRAM_API_KEY` in environment variables

#### Mailjet (Email Service)
1. Create account at [Mailjet](https://www.mailjet.com/)
2. Get API key and secret from dashboard
3. Update `MAILJET_API_KEY` and `MAILJET_SECRET_KEY` in environment variables

## 🎯 Usage Workflow

### 1. User Registration/Login
- Register as a recruiter
- Login to access the dashboard

### 2. Create Job Posting
- Upload job description
- Add candidate resumes
- AI automatically analyzes and scores candidates

### 3. Review Results
- View candidate rankings and scores
- Filter and search through candidates
- Select candidates for interviews

### 4. Schedule Interviews
- Set interview time windows
- Send automated invitations
- Monitor interview sessions

### 5. Conduct AI Interviews
- Candidates join via secure link
- AI conducts professional interviews
- Real-time proctoring and monitoring
- Automatic scoring and feedback

### 6. Review Results
- Access detailed interview reports
- View performance analytics
- Make informed hiring decisions

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: Bcrypt encryption for user passwords
- **CORS Protection**: Configured for secure cross-origin requests
- **Input Validation**: Comprehensive input sanitization
- **Rate Limiting**: Protection against abuse
- **Secure Cookies**: HTTP-only cookies with proper settings

## 🚀 Deployment

### Production Considerations

1. **Environment Variables**: Set `COOKIE_SECURE=true` and `COOKIE_SAMESITE=None` for HTTPS
2. **Database**: Use production MongoDB and Qdrant instances
3. **API Keys**: Ensure all AI service API keys are properly configured
4. **SSL/TLS**: Enable HTTPS for secure communication
5. **Monitoring**: Set up logging and monitoring for production environment

### Docker Deployment (Optional)

Create `docker-compose.yml` for easy deployment:

```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - MONGODB_URL=mongodb://mongo:27017
      - QDRANT_URL=http://qdrant:6333
    depends_on:
      - mongo
      - qdrant

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend

  mongo:
    image: mongo:latest
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
    volumes:
      - qdrant_data:/qdrant/storage

volumes:
  mongo_data:
  qdrant_data:
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation for common issues

## 🔮 Future Enhancements

- **Multi-language Support**: Interview support for multiple languages
- **Advanced Analytics**: Machine learning insights for hiring trends
- **Integration APIs**: Connect with popular HR tools and ATS systems
- **Mobile App**: Native mobile applications for iOS and Android
- **Advanced Proctoring**: Enhanced AI-based cheating detection
- **Video Analytics**: Facial expression and body language analysis

---

**HireHelper** - Transforming recruitment with AI-powered intelligence.
