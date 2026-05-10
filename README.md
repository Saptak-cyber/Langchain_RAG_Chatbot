# NotebookLLM — RAG-Powered Document Chat

A Google NotebookLM clone built with Next.js that allows users to upload documents (PDF/CSV) and have intelligent conversations with them using Retrieval-Augmented Generation (RAG).

## 🎯 Project Overview

This application implements a complete RAG pipeline where users can:
- Upload PDF or CSV documents
- Have the system intelligently chunk, embed, and index the content
- Ask natural language questions about the document
- Receive grounded answers based solely on the document's content (no hallucinations)

Built as part of **Assignment 03 — Google NotebookLM RAG** to demonstrate end-to-end RAG implementation.

## 🏗️ Architecture

### RAG Pipeline Flow

```
Document Upload → Document Loading → Chunking → Embedding → Vector Storage → Retrieval → LLM Generation
```

### Tech Stack

- **Frontend**: Next.js 16, React 19, TailwindCSS
- **Document Processing**: LangChain, pdf-parse
- **Embeddings**: Hugging Face Inference API (BAAI/bge-small-en-v1.5)
- **Vector Database**: Qdrant Cloud
- **LLM**: Groq (Llama 3.1 8B Instant)
- **Orchestration**: LangChain

## 📋 Features

### ✅ Complete RAG Pipeline

1. **Document Ingestion** (`/api/ingest`)
   - Accepts PDF and CSV file uploads
   - Validates file types and processes content
   - Generates unique document IDs for tracking

2. **Document Loading** (`lib/rag/load-document.ts`)
   - Uses LangChain loaders (PDFLoader, CSVLoader)
   - Handles temporary file management
   - Attaches metadata (documentId, filename, sourceType)

3. **Chunking Strategy** (`lib/rag/chunk.ts`)
   - **Strategy**: Recursive Character Text Splitter
   - **Chunk Size**: 1000 characters
   - **Overlap**: 200 characters
   - Preserves context across chunk boundaries
   - Handles various document structures intelligently

4. **Embedding Generation** (`lib/rag/hf-inference-embeddings.ts`)
   - Model: `BAAI/bge-small-en-v1.5` (384 dimensions)
   - Hugging Face Inference API integration
   - Custom mean-pooling for token-level embeddings
   - Handles various tensor shapes from HF API

5. **Vector Storage** (`lib/rag/vectorstore.ts`)
   - Qdrant Cloud vector database
   - Automatic collection creation
   - Payload indexing on `metadata.documentId` for filtering
   - Document-scoped retrieval (multi-document support)

6. **Retrieval** (`lib/rag/vectorstore.ts`)
   - Similarity search with k=6 most relevant chunks
   - Document-specific filtering
   - Returns chunks with metadata and scores

7. **Answer Generation** (`/api/chat`)
   - Groq LLM (Llama 3.1 8B Instant)
   - System prompt enforces grounding in retrieved context
   - Prevents hallucination by restricting to document content
   - Returns answer with source citations

### 🎨 User Interface

- Clean, modern interface inspired by Google NotebookLM
- Drag-and-drop file upload
- Real-time chat interface with markdown support
- Source citations for transparency
- Multi-document management
- Persistent state using localStorage

## 🚀 Getting Started

### Prerequisites

- Node.js 20+ and npm
- Accounts and API keys for:
  - [Hugging Face](https://huggingface.co/) (free tier)
  - [Groq](https://console.groq.com/) (free tier)
  - [Qdrant Cloud](https://cloud.qdrant.io/) (free tier)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd notebookllm
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Copy `.env.example` to `.env` and fill in your API keys:
   ```bash
   cp .env.example .env
   ```

   Required variables:
   ```env
   # Hugging Face — for embeddings
   HF_TOKEN=hf_your_token_here

   # Groq — for LLM
   GROQ_API_KEY=gsk_your_key_here

   # Qdrant Cloud — for vector storage
   QDRANT_URL=https://your-cluster.qdrant.io
   QDRANT_API_KEY=your_qdrant_api_key
   ```

   Optional variables:
   ```env
   # Override defaults if needed
   GROQ_MODEL=llama-3.1-8b-instant
   QDRANT_COLLECTION_NAME=notebookllm

   # LangSmith tracing (recommended for debugging)
   LANGSMITH_TRACING=true
   LANGSMITH_API_KEY=ls__your_key_here
   LANGSMITH_PROJECT=notebookllm
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open the application**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

### Usage

1. **Upload a document**: Click "Upload" or drag-and-drop a PDF/CSV file
2. **Wait for processing**: The system will chunk, embed, and index your document
3. **Ask questions**: Type your question in the chat interface
4. **View answers**: Get grounded answers with source citations

## 📁 Project Structure

```
notebookllm/
├── app/
│   ├── api/
│   │   ├── chat/route.ts          # Chat endpoint with RAG
│   │   └── ingest/route.ts        # Document upload & processing
│   ├── components/
│   │   └── notebook/              # UI components
│   │       ├── ChatThread.tsx     # Message display
│   │       ├── Composer.tsx       # Input interface
│   │       ├── NotebookShell.tsx  # Main layout
│   │       ├── Sidebar.tsx        # Document list
│   │       ├── SourceDrawer.tsx   # Source citations
│   │       └── UploadDropzone.tsx # File upload
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   └── rag/
│       ├── chat.ts                # Groq LLM configuration
│       ├── chunk.ts               # Document chunking logic
│       ├── constants.ts           # RAG configuration constants
│       ├── hf-inference-embeddings.ts  # HF embeddings
│       ├── load-document.ts       # Document loaders
│       └── vectorstore.ts         # Qdrant integration
├── .env.example                   # Environment template
├── package.json
└── README.md
```

## 🔧 Configuration

### Chunking Parameters

Adjust in `lib/rag/constants.ts`:
```typescript
export const CHUNK_SIZE = 1000;      // Characters per chunk
export const CHUNK_OVERLAP = 200;    // Overlap between chunks
```

### Retrieval Parameters

```typescript
export const RETRIEVAL_K = 6;        // Number of chunks to retrieve
```

### LLM Model

Change in `.env`:
```env
GROQ_MODEL=llama-3.1-8b-instant     # Or other Groq models
```

## 🧪 How It Works

### 1. Document Ingestion Flow

```typescript
// User uploads file → API receives it
POST /api/ingest
  ↓
// Load document with metadata
loadDocumentsFromBuffer(buffer, filename, documentId)
  ↓
// Split into chunks with overlap
chunkDocuments(rawDocs)  // RecursiveCharacterTextSplitter
  ↓
// Generate embeddings
HuggingFaceBgeEmbeddings.embedDocuments(chunks)
  ↓
// Store in Qdrant with metadata
addDocumentsToStore(embeddings, chunks)
```

### 2. Question Answering Flow

```typescript
// User asks question → API receives it
POST /api/chat { documentId, message }
  ↓
// Embed the question
embeddings.embedQuery(message)
  ↓
// Retrieve relevant chunks (k=6)
retriever.invoke(message)  // Filtered by documentId
  ↓
// Build context from chunks
context = chunks.map(doc => doc.pageContent).join('\n\n')
  ↓
// Generate answer with LLM
llm.invoke([
  SystemMessage(SYSTEM_PROMPT),
  HumanMessage(`Context: ${context}\n\nQuestion: ${message}`)
])
  ↓
// Return answer + sources
{ answer, sources }
```

### 3. Grounding Strategy

The system prompt enforces strict grounding:

```typescript
const SYSTEM_PROMPT = `You are a helpful assistant. Answer the user's question using ONLY the context provided below.
If the answer cannot be found in the context, say "I don't have enough information in the document to answer that."
Do not use your general knowledge — stick strictly to the provided context.`;
```

This prevents the LLM from hallucinating or using its pre-trained knowledge.

## 🎓 Assignment Requirements

### ✅ Checklist

- [x] **Working Application**: Web UI with Next.js
- [x] **Full RAG Pipeline**: Ingestion → Chunking → Embedding → Storage → Retrieval → Generation
- [x] **Chunking Strategy**: RecursiveCharacterTextSplitter with 1000 char chunks, 200 char overlap
- [x] **Vector Database**: Qdrant Cloud with document-scoped filtering
- [x] **Grounded Answers**: System prompt enforces context-only responses
- [x] **Handles New Documents**: UUID-based document tracking, no hardcoding
- [x] **Code Quality**: TypeScript, modular architecture, error handling
- [x] **Documentation**: Comprehensive README with architecture details

## 🚢 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy

### Environment Variables for Production

Ensure all required variables are set:
- `HF_TOKEN`
- `GROQ_API_KEY`
- `QDRANT_URL`
- `QDRANT_API_KEY`

## 🐛 Troubleshooting

### Common Issues

**"HF_TOKEN environment variable is required"**
- Ensure `.env` file exists and contains valid Hugging Face token
- Restart dev server after adding environment variables

**"QDRANT_URL environment variable is required"**
- Create a free Qdrant Cloud cluster
- Copy the cluster URL and API key to `.env`

**"Empty embedding response from Hugging Face"**
- Check HF_TOKEN is valid and has not expired
- Verify network connectivity to Hugging Face API

**Chunks not being retrieved**
- Ensure document was successfully ingested (check console logs)
- Verify documentId matches between ingestion and chat
- Check Qdrant collection exists and has vectors

## 📊 Performance Considerations

- **Embedding Model**: bge-small-en-v1.5 is fast and efficient (384 dims)
- **LLM**: Llama 3.1 8B Instant provides quick responses via Groq
- **Chunking**: 1000 char chunks balance context and precision
- **Retrieval**: k=6 provides sufficient context without overwhelming the LLM

## 🔒 Security Notes

- API keys are server-side only (not exposed to client)
- File uploads are validated for type and size
- Temporary files are cleaned up after processing
- Document IDs use cryptographically secure UUIDs

## 📝 License

This project is for educational purposes as part of a Gen-AI course assignment.

## 🙏 Acknowledgments

- Built with [LangChain](https://langchain.com/)
- Embeddings by [Hugging Face](https://huggingface.co/)
- LLM by [Groq](https://groq.com/)
- Vector DB by [Qdrant](https://qdrant.tech/)
- Framework by [Next.js](https://nextjs.org/)

---

**Assignment**: Google NotebookLM RAG Clone  
**Course**: Gen-AI  
**Year**: 2nd Year
