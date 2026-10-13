# DocuFlow AI Platform

An enterprise **Retrieval-Augmented Generation (RAG)** platform built on **Next.js 15 (App Router & Turbopack)** deployed on **Render**, designed for automated document ingestion from **UiPath Studio RPA bots** and serverless vector search with **Pinecone** (`rag-documents`).

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph Ingestion ["1. Automation & Ingestion Layer"]
        UIPATH[UiPath Studio Bot] -->|HTTP POST JSON / Multipart| API_INGEST["/api/ingest (Webhook)"]
        UI_UPLOAD[Dashboard Manual Upload] --> API_INGEST
    end

    subgraph Processing ["2. Processing & Embedding"]
        API_INGEST --> EXTRACT[Text Extractor: PDF/DOCX/TXT/JSON]
        EXTRACT --> CHUNK[Recursive Text Chunker with Overlap]
        CHUNK --> EMBED[Embedding Generator: 1536-dim]
    end

    subgraph Storage ["3. Vector Database"]
        EMBED --> VDB[(Pinecone Serverless: rag-documents)]
    end

    subgraph Retrieval ["4. Conversational RAG & Q&A"]
        USER((User)) <--> CHAT_UI["Conversational Q&A UI"]
        CHAT_UI <--> API_CHAT["/api/chat (Streaming SSE)"]
        API_CHAT --> QUERY_VEC[Generate Query Vector]
        QUERY_VEC --> VDB
        VDB -->|Top-K Context Chunks| API_CHAT
        API_CHAT --> LLM[OpenAI / Gemini LLM]
        LLM -->|Streamed Response + Citations| CHAT_UI
    end
```

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Node.js 20+ installed
- npm 10+

### 2. Run Locally with Turbopack
```bash
# Install dependencies
npm install

# Start development server with Turbopack (instant startup & HMR)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser:
- **Conversational Q&A**: `http://localhost:3000/chat`
- **Document Registry**: `http://localhost:3000/documents`

---

## 🔑 Required API Keys & Configuration

Configure `.env.local` with your credentials:

### 1. Vector Database: Pinecone (Free Cloud Serverless)
* **What it does**: Stores vector embeddings and performs cosine similarity search.
* **Where to get it**:
  1. Go to [pinecone.io](https://www.pinecone.io/) and create an account.
  2. Copy your **API Key** from the Pinecone console.
* **Set in `.env.local`**:
  ```env
  PINECONE_API_KEY=pcsk_xxxxxxxxxxxxxxxxxxxx
  PINECONE_INDEX_NAME=rag-documents
  ```
  *(The application will automatically provision the `rag-documents` serverless index on first use if it does not already exist).*

---

### 2. AI Provider: OpenAI (or Gemini)
* **What it does**: Generates embeddings (`text-embedding-3-small`) and answers questions (`gpt-4o-mini`).
* **Where to get it**:
  1. Visit [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
  2. Click **Create new secret key** and copy it (`sk-...`).
* **Set in `.env.local`**:
  ```env
  OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxx
  OPENAI_CHAT_MODEL=gpt-4o-mini
  OPENAI_EMBEDDING_MODEL=text-embedding-3-small
  ```

---

### 3. UiPath Shared Webhook Token
* **What it does**: Secures your `/api/ingest` webhook so only authorized UiPath robots can send documents.
* **Set in `.env.local`**:
  ```env
  UIPATH_API_KEY=dev-uipath-secret-key-12345
  ```

---

## 🤖 UiPath Studio Bot Integration Guide

UiPath Studio bots extract text from PDFs, emails, invoices, or file shares and push them to your backend via HTTP POST.

### Low-Latency JSON Ingestion (Recommended)
Configure UiPath's **HTTP Request** activity:
- **Endpoint**: `https://<your-render-app>.onrender.com/api/ingest`
- **Method**: `POST`
- **Headers**:
  - `Content-Type`: `application/json`
  - `Authorization`: `Bearer dev-uipath-secret-key-12345`
- **Body / Payload**:
  ```json
  {
    "title": "Vendor_Contract_AcmeCorp.pdf",
    "source": "UiPath Bot - Procurement Inbox",
    "content": "This Agreement is entered into by Acme Corp. Termination requires 30 days notice...",
    "metadata": {
      "department": "Procurement",
      "botId": "BOT-PROC-04",
      "extractedDate": "2026-10-12"
    }
  }
  ```

### cURL Test Command
```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-uipath-secret-key-12345" \
  -d '{
    "title": "Sample_HR_Policy.txt",
    "source": "UiPath RPA Bot",
    "content": "Employees are eligible for 25 days annual leave. Travel reimbursement requests must be submitted within 14 days of travel.",
    "metadata": { "department": "HR" }
  }'
```

---

## ☁️ Deployment on Render (`render.com`)

The repository includes a `render.yaml` blueprint:

1. Push your code to **GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Deploy DocuFlow AI platform"
   git branch -M main
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```
2. Log into [Render](https://render.com/) and click **New +** -> **Blueprint**.
3. Select your repository. Render will automatically read `render.yaml` and configure the build:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
4. Add your secret environment variables (`PINECONE_API_KEY`, `OPENAI_API_KEY`, `UIPATH_API_KEY`).
5. Click **Apply** to deploy!
