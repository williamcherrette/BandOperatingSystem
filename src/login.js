import React, { useState } from "react";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth"; // Import sendPasswordResetEmail
import { auth } from "./firebase";

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      onLogin(userCredential.user); // Notify parent component of successful login
    } catch (error) {
      setError("Invalid email or password. Please try again.");
    }
  };

  // Add the password reset function
  const handlePasswordReset = async () => {
    if (!email) {
      setError("Please enter your email to reset your password.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      alert("Password reset email sent! Check your inbox.");
      setError(""); // Clear any previous errors
    } catch (error) {
      console.error("Error sending password reset email:", error);
      setError("Failed to send password reset email. Please try again.");
    }
  };

  return (
    <div>
      <h2>Login</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Login</button>
      </form>
      {/* Add the Forgot Password button */}
      <button
  type="button"
  onClick={handlePasswordReset}
  disabled={!email}
  style={{ marginTop: "10px" }}
>
  Forgot Password?
</button>
    </div>
  );
};

export default Login;