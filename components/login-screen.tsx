"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Eye, EyeOff, Play, Shield, Zap, TrendingUp, MoonIcon, SunIcon } from "lucide-react"

interface LoginScreenProps {
  onLogin: (apiKey: string, rememberMe: boolean) => void
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [apiKey, setApiKey] = useState("")
  const [showApiKey, setShowApiKey] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [theme, setTheme] = useState<"light" | "dark">("dark")

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark"
    setTheme(newTheme)
    document.documentElement.classList.toggle("dark", newTheme === "dark")
    localStorage.setItem("theme", newTheme)
  }

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null
    if (savedTheme) {
      setTheme(savedTheme)
      document.documentElement.classList.toggle("dark", savedTheme === "dark")
    } else {
      document.documentElement.classList.add("dark")
    }
  }, [])

  const validateApiKey = async (key: string): Promise<boolean> => {
    try {
      const timestamp = Date.now().toString()
      const response = await fetch("https://broker-api.mybroker.dev/token/wallets", {
        method: "GET",
        headers: {
          "api-token": key,
          "x-timestamp": timestamp,
        },
      })

      return response.ok
    } catch (error) {
      console.error("Erro na validação:", error)
      return false
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!apiKey.trim()) {
      setError("Por favor, insira sua chave API")
      return
    }

    setIsLoading(true)
    setError("")

    const isValid = await validateApiKey(apiKey.trim())

    if (isValid) {
      onLogin(apiKey.trim(), rememberMe)
    } else {
      setError("Chave API inválida. Verifique e tente novamente.")
    }

    setIsLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-muted/20 to-background"></div>

      <div className="absolute top-4 right-4 z-20">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          className="text-muted-foreground hover:text-primary"
          title={theme === "dark" ? "Modo Claro" : "Modo Escuro"}
        >
          {theme === "dark" ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
        </Button>
      </div>

      <div className="relative z-10 w-full max-w-md space-y-8 animate-in fade-in-0 slide-in-from-bottom-4 duration-1000">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <img
              src="/VISION.png"
              alt="Vision Academy Logo"
              className="h-16 w-auto filter brightness-110 drop-shadow-2xl"
            />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-primary">Bem-vindo de volta</h1>
            <p className="text-muted-foreground">Acesse sua conta com sua chave API</p>
          </div>
        </div>

        {/* Login Card */}
        <Card className="bg-card/95 backdrop-blur-sm border-border/60 shadow-2xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center text-primary">Login</CardTitle>
            <CardDescription className="text-center">Insira sua chave API para acessar o dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="apiKey" className="text-foreground">
                  Chave API
                </Label>
                <div className="relative">
                  <Input
                    id="apiKey"
                    type={showApiKey ? "text" : "password"}
                    placeholder="Insira sua chave API"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="pr-10 bg-background/50 border-border/60 focus:border-primary focus:ring-primary/20"
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowApiKey(!showApiKey)}
                    disabled={isLoading}
                  >
                    {showApiKey ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              {error && (
                <div className="text-destructive text-sm bg-destructive/10 p-3 rounded-md border border-destructive/20">
                  {error}
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  className="border-border/60 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <Label htmlFor="remember" className="text-sm text-muted-foreground">
                  Lembrar de mim
                </Label>
              </div>

              <Button
                type="submit"
                className="w-full gradient-silver hover:gradient-silver-hover text-primary-foreground font-semibold py-2.5 transition-all duration-300 transform hover:scale-[1.02] disabled:scale-100"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground"></div>
                    <span>Validando...</span>
                  </div>
                ) : (
                  "Entrar"
                )}
              </Button>
            </form>

            {/* Help Section */}
            <div className="mt-6 pt-6 border-t border-border/40">
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full border-border/60 text-primary hover:bg-primary/10 bg-transparent"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Como obter minha chave API?
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px] bg-card/95 backdrop-blur-sm border-border/60">
                  <DialogHeader>
                    <DialogTitle className="text-primary">Como obter sua chave API</DialogTitle>
                  </DialogHeader>
                  <div className="aspect-video">
                    <iframe
                      width="100%"
                      height="100%"
                      src="https://www.youtube.com/embed/0M62A5oPVNA"
                      title="Como obter chave API"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="rounded-lg"
                    ></iframe>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-2">
            <Shield className="h-8 w-8 mx-auto text-primary" />
            <p className="text-xs text-muted-foreground">Seguro</p>
          </div>
          <div className="space-y-2">
            <Zap className="h-8 w-8 mx-auto text-primary" />
            <p className="text-xs text-muted-foreground">Rápido</p>
          </div>
          <div className="space-y-2">
            <TrendingUp className="h-8 w-8 mx-auto text-primary" />
            <p className="text-xs text-muted-foreground">Tempo Real</p>
          </div>
        </div>
      </div>
    </div>
  )
}
