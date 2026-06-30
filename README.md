<div align="center">

# ⚙️ VectraLern Server

<!-- Placeholder Badges -->

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg?style=for-the-badge)
![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg?style=for-the-badge)
![License: ISC](https://img.shields.io/badge/License-ISC-yellow.svg?style=for-the-badge)

### The robust Node.js and Express backend API for the VectraLern online learning platform. Handles secure JWT verification, MongoDB data management, analytics, and role-based actions.

![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)
![MongoDB](https://img.shields.io/badge/MongoDB-001E2B?style=for-the-badge&logo=mongodb&logoColor=4DB33D)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

</div>

---

## 📑 Table of Contents

- [Brief Description](#-brief-description)
- [Tech Stack](#-tech-stack)
- [Key Features](#-key-features)
- [Prerequisites](#-prerequisites)
- [Installation Steps](#-installation-steps)
- [Usage](#-usage)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Brief Description

VectraLern Server is the core backend engine supporting the VectraLern e-learning ecosystem. It solves the complexity of managing multi-role educational platforms by providing a highly structured, scalable API that handles JWT authentication, course transactions, user enrollments, and analytical data aggregation, fully optimized for serverless environments.

## 🛠 Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (Native Driver)
- **Security/Auth**: `jose-cjs` (Remote JWKS verification), CORS
- **Environment**: `dotenv`
- **Deployment**: Vercel (via `vercel.json` config)

## ✨ Key Features

1. **Secure JWT Authentication**: Seamlessly integrates with the client's BetterAuth system using Remote JWKS verification to protect API routes.
2. **Role-Based API Architecture**: Dedicated endpoint logic securely segregated via custom middlewares for Students, Instructors, and Admins (`isAdmin`, `isNotBlocked`).
3. **Optimized DB Connections**: Implements connection caching algorithms specifically designed to prevent memory leaks during serverless deployment on Vercel.
4. **Comprehensive Data Management**: Centralized logic for course approvals, wishlist toggling, student enrollment tracking, and platform-wide analytics aggregation.

## 📦 Prerequisites

Before running the server, ensure you have the following installed:

- **Node.js**: v18.x or higher
- **Package Manager**: `npm`, `yarn`, or `pnpm`
- **MongoDB**: A running MongoDB instance or MongoDB Atlas cluster connection string

## 🚀 Installation Steps

Follow these steps to run the server locally.

**1. Clone the repository and navigate to the server folder:**

```bash
git clone https://github.com/toufiqweb/vectraLearn.git
cd vectraLearn/vectraLearn-server
```

**2. Install dependencies:**

```bash
npm install
```

**3. Set up Environment Variables:**
Create a `.env` file in the root of your `vectraLearn-server` directory using the following structure:

```env
# Database Configuration
MONGO_URI=mongodb+srv://<username>:<password>@cluster0...
DB_NAME=vectraLearn

# Admin and Client Configurations
SUPER_ADMIN_EMAIL=admin@example.com
ALLOWED_ORIGIN=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Payments (If utilizing server-side Stripe webhook handling)
STRIPE_SECRET_KEY=sk_test_your_secret_key
```

## 💻 Usage

To start the local development server, run the following command from the root of the server directory:

```bash
node index.js
```

_(Note: For automatic restarts during active development, it is recommended to run `npx nodemon index.js`)_

**Testing the API Connection:**
Once the server is running, you can send a basic `GET` request (or simply navigate your browser) to the root endpoint:

```bash
curl http://localhost:5000/
# Expected Output: API is running...
```

## 🤝 Contributing

We welcome backend contributions! Please adhere to these standard open-source guidelines:

1. **Fork the Project:** Create your own fork of the repository.
2. **Create a Feature Branch:**
   ```bash
   git checkout -b feature/NewEndpoint
   ```
3. **Commit your Changes:**
   ```bash
   git commit -m 'Add a NewEndpoint to handle X'
   ```
4. **Push to the Branch:**
   ```bash
   git push origin feature/NewEndpoint
   ```
5. **Open a Pull Request:** Submit your PR against the `main` branch with detailed information about the API changes.

## 📄 License

Distributed under the **ISC License**. See `package.json` for details.

---

<div align="center">
  <p>Backend API for VectraLern Designed and Developed with by <strong>Toufiq Alahe</strong></p>
</div>
