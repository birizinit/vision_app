"use client"

import { useState, useEffect } from "react"
import { Dashboard } from "@/components/dashboard"
import { LoginScreen } from "@/components/login-screen"

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [apiKey, setApiKey] = useState<string | null>(null)

  useEffect(() => {
    // Verificar se há uma sessão salva
    const savedApiKey = sessionStorage.getItem("broker_api_key")
    const rememberMe = localStorage.getItem("broker_remember_me")

    if (savedApiKey || rememberMe) {
      const keyToUse = savedApiKey || rememberMe
      if (keyToUse) {
        setApiKey(keyToUse)
        setIsAuthenticated(true)
      }
    }
    setIsLoading(false)
  }, [])

  const handleLogin = (key: string, remember: boolean) => {
    setApiKey(key)
    setIsAuthenticated(true)

    // Armazenar a chave
    sessionStorage.setItem("broker_api_key", key)
    if (remember) {
      localStorage.setItem("broker_remember_me", key)
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setApiKey(null)
    sessionStorage.removeItem("broker_api_key")
    localStorage.removeItem("broker_remember_me")
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      {isAuthenticated && apiKey ? (
        <Dashboard apiKey={apiKey} onLogout={handleLogout} />
      ) : (
        <LoginScreen onLogin={handleLogin} />
      )}
    </main>
  )
}
