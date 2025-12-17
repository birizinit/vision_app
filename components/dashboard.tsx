"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ArrowUpIcon,
  ArrowDownIcon,
  TrendingUpIcon,
  EyeIcon,
  EyeOffIcon,
  RefreshCwIcon,
  BellIcon,
  SettingsIcon,
  LogOutIcon,
  BotIcon,
  PlayIcon,
  PauseIcon,
} from "lucide-react"
import { CryptoCard } from "@/components/crypto-card"
import { TransactionHistory } from "@/components/transaction-history"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface CryptoData {
  id: string
  symbol: string
  name: string
  current_price: number
  price_change_percentage_24h: number
  image: string
}

interface WalletData {
  id: string
  userId: string
  type: string
  balance: number
  createdAt: string
}

interface Trade {
  id: string
  symbol: string
  direction: "BUY" | "SELL"
  amount: number
  openTime: string
  closeTime?: string
  status: "PENDING" | "WIN" | "LOSS" | "CANCELLED"
  payout?: number
  result?: number
}

interface BotStats {
  totalTrades: number
  wins: number
  losses: number
  profit: number
  isRunning: boolean
  lastTradeTime?: string
}

interface DashboardProps {
  apiKey: string
  onLogout: () => void
}

export function Dashboard({ apiKey, onLogout }: DashboardProps) {
  const [cryptoData, setCryptoData] = useState<CryptoData[]>([])
  const [loading, setLoading] = useState(true)
  const [walletData, setWalletData] = useState<WalletData[]>([])
  const [totalBalance, setTotalBalance] = useState(0)
  const [showBalance, setShowBalance] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [walletLoading, setWalletLoading] = useState(true)

  const [botEnabled, setBotEnabled] = useState(false)
  const [botStats, setBotStats] = useState<BotStats>({
    totalTrades: 0,
    wins: 0,
    losses: 0,
    profit: 0,
    isRunning: false,
  })
  const [activeTrades, setActiveTrades] = useState<Trade[]>([])
  const [completedTrades, setCompletedTrades] = useState<Trade[]>([])
  const botIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const sessionStartTimeRef = useRef<number>(Date.now())
  const activeTradesCountRef = useRef<number>(0)
  const lastTradeTimeRef = useRef<number>(0)
  const botActiveRef = useRef<boolean>(false)

  const [baseTradeAmount, setBaseTradeAmount] = useState<number>(1)
  const [baseTradeAmountInput, setBaseTradeAmountInput] = useState<string>("1")
  const [protections, setProtections] = useState<number>(0)
  const [consecutiveLosses, setConsecutiveLosses] = useState<number>(0)
  const [currentTradeAmount, setCurrentTradeAmount] = useState<number>(1)
  const [lastLossSymbol, setLastLossSymbol] = useState<string | null>(null)
  const [lastLossDirection, setLastLossDirection] = useState<"BUY" | "SELL" | null>(null)

  const [stopWinPercent, setStopWinPercent] = useState<number>(10)
  const [stopLossPercent, setStopLossPercent] = useState<number>(5)
  const tradingSectionRef = useRef<HTMLDivElement | null>(null)

  const [showValidationDialog, setShowValidationDialog] = useState(false)
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(false)
  const [showStopDialog, setShowStopDialog] = useState(false)
  const [stopDialogMessage, setStopDialogMessage] = useState("")

  const isBotConfigValid = () => {
    return baseTradeAmount > 0 && 
           protections >= 0 && 
           stopWinPercent > 0 && 
           stopLossPercent > 0
  }

  const BOT_SYMBOLS = ["APPLE.OTC", "XRPUSDT", "ETHUSDT", "BTCUSDT", "SOLUSDT", "GOOGLUSDT.OTC"]
  const CLOSE_TYPE = "01:00"
  const TRADE_INTERVAL = 60000

  // Lógica do Maertingale: dobra o valor após cada perda consecutiva
  useEffect(() => {
    console.log('[MARTINGALE useEffect] consecutiveLosses:', consecutiveLosses, 'protections:', protections, 'baseTradeAmount:', baseTradeAmount)
    
    // Se não há proteções configuradas (0), sempre usa o valor base
    if (protections === 0) {
      setCurrentTradeAmount(baseTradeAmount)
      console.log('[MARTINGALE] Sem proteções configuradas - usando valor base:', baseTradeAmount)
      return
    }
    
    // Se não há perdas consecutivas, usa o valor base
    if (consecutiveLosses <= 0) {
      setCurrentTradeAmount(baseTradeAmount)
      console.log('[MARTINGALE] Sem perdas consecutivas - usando valor base:', baseTradeAmount)
      return
    }

    // Se atingiu ou ultrapassou o limite de proteções, volta ao valor base
    // Exemplo: protections = 1 permite até 1 perda (2x), se tiver 2 perdas, volta ao base
    if (consecutiveLosses > protections) {
      setCurrentTradeAmount(baseTradeAmount)
      console.log('[MARTINGALE] Limite de proteções atingido (' + protections + ') - voltando ao valor base:', baseTradeAmount)
      return
    }

    // Calcula o valor do Martingale: dobra após cada perda
    // Exemplo: 1 perda = 2x, 2 perdas = 4x, 3 perdas = 8x
    const newAmount = baseTradeAmount * Math.pow(2, consecutiveLosses)
    
    console.log('[MARTINGALE] ======== CÁLCULO DO VALOR ========')
    console.log('[MARTINGALE] Perdas consecutivas:', consecutiveLosses)
    console.log('[MARTINGALE] Proteções configuradas:', protections)
    console.log('[MARTINGALE] Valor base:', baseTradeAmount)
    console.log('[MARTINGALE] Multiplicador (2^' + consecutiveLosses + '):', Math.pow(2, consecutiveLosses))
    console.log('[MARTINGALE] NOVO VALOR DA PRÓXIMA OPERAÇÃO:', newAmount)
    console.log('[MARTINGALE] =====================================')
    
    setCurrentTradeAmount(newAmount)
  }, [consecutiveLosses, baseTradeAmount, protections])

  const fetchWalletData = async () => {
    try {
      const timestamp = Date.now().toString()
      const response = await fetch("https://broker-api.mybroker.dev/token/wallets", {
        method: "GET",
        headers: {
          "api-token": apiKey,
          "x-timestamp": timestamp,
        },
      })

      if (response.ok) {
        const data: WalletData[] = await response.json()
        setWalletData(data)

        // Calculate total balance
       const total = data.filter((wallet) => wallet.type === "REAL").reduce((sum, wallet) => sum + wallet.balance, 0)
        setTotalBalance(total)
      } else {
        console.error("Error fetching wallet data:", response.status)
        // Fallback to example data if API fails
        setTotalBalance(125847.32)
      }
    } catch (error) {
      console.error("Error in wallet request:", error)
      // Fallback to example data
      setTotalBalance(125847.32)
    } finally {
      setWalletLoading(false)
    }
  }

  const fetchCryptoData = async () => {
    setRefreshing(true)
    try {
      const response = await fetch(
        "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,ripple,binancecoin,solana,cardano&order=market_cap_desc&per_page=6&page=1&sparkline=false",
      )
      const data = await response.json()
      setCryptoData(data)
    } catch (error) {
      console.error("Error fetching crypto data:", error)
      // Fallback data for demo
      setCryptoData([
        {
          id: "bitcoin",
          symbol: "btc",
          name: "Bitcoin",
          current_price: 43250.0,
          price_change_percentage_24h: 2.5,
          image: "/bitcoin-logo.png",
        },
        {
          id: "ethereum",
          symbol: "eth",
          name: "Ethereum",
          current_price: 2650.0,
          price_change_percentage_24h: -1.2,
          image: "/ethereum-logo.png",
        },
        {
          id: "ripple",
          symbol: "xrp",
          name: "XRP",
          current_price: 0.62,
          price_change_percentage_24h: 4.8,
          image: "/xrp-logo.jpg",
        },
        {
          id: "binancecoin",
          symbol: "bnb",
          name: "BNB",
          current_price: 315.5,
          price_change_percentage_24h: 1.9,
          image: "/binance-logo.png",
        },
        {
          id: "solana",
          symbol: "sol",
          name: "Solana",
          current_price: 98.75,
          price_change_percentage_24h: -0.8,
          image: "/solana-logo.png",
        },
        {
          id: "cardano",
          symbol: "ada",
          name: "Cardano",
          current_price: 0.48,
          price_change_percentage_24h: 3.2,
          image: "/cardano-logo.jpg",
        },
      ])
    } finally {
      setLoading(false)
      setTimeout(() => setRefreshing(false), 500)
    }
  }

  const fetchTrades = async (): Promise<{ losses: number; symbol: string | null; direction: "BUY" | "SELL" | null; profit: number } | null> => {
    try {
      const timestamp = Date.now().toString()
      const response = await fetch("https://broker-api.mybroker.dev/token/trades?page=1&pageSize=10", {
        method: "GET",
        headers: {
          "api-token": apiKey,
          "x-timestamp": timestamp,
        },
      })

      if (response.ok) {
        const data = await response.json()
        console.log("[v0] Trades from API:", data)

        const rawTrades = Array.isArray(data?.data) ? data.data : []

        const normalizeStatus = (trade: any): Trade["status"] => {
          if (trade.result === "WON") return "WIN"
          if (trade.result === "LOST") return "LOSS"
          if (trade.result === "CANCELLED" || trade.status === "CANCELLED") return "CANCELLED"
          if (trade.result === "PENDING") return "PENDING"
          return "PENDING"
        }

        const normalizedTrades: Trade[] = rawTrades.map((trade: any) => ({
          id: trade.id,
          symbol: trade.symbol,
          direction: trade.direction,
          amount: trade.amount,
          openTime: trade.createdAt,
          closeTime: trade.updatedAt,
          status: normalizeStatus(trade),
          payout: trade.payout ?? trade.pnl ?? 0,
          result: trade.pnl ?? 0,
        }))

        // Filtrar apenas operações criadas APÓS o início da sessão
        const sessionStartTime = sessionStartTimeRef.current
        const filteredTrades = normalizedTrades.filter((trade) => {
          const tradeOpenTime = new Date(trade.openTime).getTime()
          return tradeOpenTime >= sessionStartTime
        })

        const sortedByOpenTime = [...filteredTrades].sort(
          (a, b) => new Date(b.openTime).getTime() - new Date(a.openTime).getTime(),
        )

        // Filtrar apenas operações que realmente estão pendentes (não finalizadas)
        const pendingTrades = sortedByOpenTime.filter((trade) => {
          // Uma operação é considerada pendente se o status é PENDING
          const isPending = trade.status === "PENDING"
          console.log(`[FETCH_TRADES] Trade ${trade.id} - status: ${trade.status}, isPending: ${isPending}`)
          return isPending
        })
        const completedTrades = sortedByOpenTime.filter((trade) => trade.status === "WIN" || trade.status === "LOSS")
        const completedSorted = [...completedTrades].sort((a, b) => {
          const aTime = a.closeTime ? new Date(a.closeTime).getTime() : new Date(a.openTime).getTime()
          const bTime = b.closeTime ? new Date(b.closeTime).getTime() : new Date(b.openTime).getTime()
          return bTime - aTime
        })

        console.log(`[FETCH_TRADES] Definindo activeTrades com ${pendingTrades.length} operações pendentes`)
        setActiveTrades(pendingTrades)
        activeTradesCountRef.current = pendingTrades.length
        setCompletedTrades(completedSorted.slice(0, 10))

        const wins = completedTrades.filter((trade) => trade.status === "WIN").length
        const losses = completedTrades.filter((trade) => trade.status === "LOSS").length
        const profit = completedTrades.reduce((sum, trade) => sum + (trade.result ?? 0), 0)
        const lastTradeTime = completedSorted.length > 0
          ? completedSorted[0].closeTime || completedSorted[0].openTime
          : undefined

        setBotStats((prev) => ({
          ...prev,
          totalTrades: pendingTrades.length + completedTrades.length,
          wins,
          losses,
          profit,
          lastTradeTime,
        }))

        // Conta perdas consecutivas (do mais recente até o primeiro WIN)
        let consecutiveLossesCount = 0
        let lastLossSymbolFound: string | null = null
        let lastLossDirectionFound: "BUY" | "SELL" | null = null
        
        for (const trade of completedSorted) {
          if (trade.status === "LOSS") {
            consecutiveLossesCount += 1
            // Captura o símbolo e direção da primeira perda (mais recente)
            if (consecutiveLossesCount === 1) {
              lastLossSymbolFound = trade.symbol
              lastLossDirectionFound = trade.direction
            }
            continue
          }

          if (trade.status === "WIN") {
            // Para no primeiro WIN encontrado
            break
          }
        }

        // Atualiza o símbolo e direção da última perda
        if (consecutiveLossesCount > 0 && lastLossSymbolFound) {
          setLastLossSymbol(lastLossSymbolFound)
          setLastLossDirection(lastLossDirectionFound)
        } else {
          // Se não há perdas consecutivas, limpa o símbolo e direção
          setLastLossSymbol(null)
          setLastLossDirection(null)
        }

        console.log('[MARTINGALE] ========================================')
        console.log('[MARTINGALE] Análise de perdas consecutivas:')
        console.log('[MARTINGALE] - Total de perdas seguidas:', consecutiveLossesCount)
        console.log('[MARTINGALE] - Símbolo da última perda:', lastLossSymbolFound)
        console.log('[MARTINGALE] - Direção da última perda:', lastLossDirectionFound)
        console.log('[MARTINGALE] - Últimas 5 operações:', completedSorted.slice(0, 5).map(t => ({
          symbol: t.symbol,
          direction: t.direction,
          status: t.status,
          result: t.result,
          date: t.closeTime
        })))
        console.log('[MARTINGALE] ========================================')
        
        setConsecutiveLosses(consecutiveLossesCount)
        return { losses: consecutiveLossesCount, symbol: lastLossSymbolFound, direction: lastLossDirectionFound, profit }
      } else {
        console.error("Error fetching trades:", response.status)
        return null
      }
    } catch (error) {
      console.error("Error in trade request:", error)
      return null
    }
  }

  const scrollToTradingSection = () => {
    tradingSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }
  const handleRefresh = async () => {
    await Promise.all([fetchCryptoData(), fetchWalletData(), fetchTrades()])
  }

  // Função auxiliar para calcular o valor do Martingale baseado nas perdas consecutivas
  const calculateMartingaleAmount = (losses: number, baseAmount: number, maxProtections: number): number => {
    // Se não há proteções configuradas (0), sempre usa o valor base
    if (maxProtections === 0) {
      return baseAmount
    }
    
    // Se não há perdas consecutivas, usa o valor base
    if (losses <= 0) {
      return baseAmount
    }

    // Se atingiu ou ultrapassou o limite de proteções, volta ao valor base
    if (losses > maxProtections) {
      return baseAmount
    }

    // Calcula o valor do Martingale: dobra após cada perda
    return baseAmount * Math.pow(2, losses)
  }

  const openAutomaticTrade = async () => {
    console.log("[BOT] openAutomaticTrade chamada - botActiveRef:", botActiveRef.current)
    try {
      // Verificar se o bot ainda está ativo ANTES de qualquer coisa
      if (!botActiveRef.current) {
        console.log("[BOT] Bot não está ativo - botActiveRef:", botActiveRef.current)
        // Silenciosamente retornar se o bot não estiver ativo
        return
      }

      const now = Date.now()
      const timeSinceLastTrade = now - lastTradeTimeRef.current
      
      // Evitar múltiplas chamadas muito próximas (mínimo 2 segundos entre tentativas)
      if (timeSinceLastTrade < 2000) {
        console.log("[BOT] Aguardando intervalo mínimo entre operações. Tempo desde última:", timeSinceLastTrade, "ms")
        return
      }
      
      console.log("[BOT] Tentando abrir nova operação - activeTradesCountRef.current:", activeTradesCountRef.current)
      
      // SEMPRE buscar trades atualizados ANTES de abrir nova operação
      // Isso garante que consecutiveLosses está atualizado e retorna o valor calculado
      const tradesData = await fetchTrades()
      
      // Verificar novamente se o bot ainda está ativo após fetchTrades
      if (!botActiveRef.current) {
        console.log("[BOT] Bot foi desativado durante fetchTrades. Parando execução.")
        return
      }
      
      // Verificar se há operações ativas - NÃO abrir nova se ainda houver pending
      if (activeTradesCountRef.current > 0) {
        console.log("[BOT] Aguardando fechamento de operação pendente.")
        return
      }

      // Calcular stop win/loss com base no saldo atual
      const stopWinAmount = totalBalance * (stopWinPercent / 100)
      const stopLossAmount = totalBalance * (stopLossPercent / 100)

      // Usar o profit calculado diretamente do fetchTrades (valor atualizado)
      const currentProfit = tradesData !== null ? tradesData.profit : botStats.profit

      // Verificar stop win/loss ANTES de abrir nova operação
      if (currentProfit >= stopWinAmount) {
        console.log("[STOP WIN] Stop Win atingido! Profit:", currentProfit, "Stop Win:", stopWinAmount)
        // Parar o bot imediatamente
        botActiveRef.current = false
        if (botIntervalRef.current) {
          clearInterval(botIntervalRef.current)
          botIntervalRef.current = null
        }
        setBotEnabled(false)
        setBotStats((prev) => ({ ...prev, isRunning: false }))
        // Mostrar popup informando stop win
        setStopDialogMessage(`Stop Win atingido! O bot foi desligado automaticamente.\n\nLucro atual: $${currentProfit.toFixed(2)}\nLimite configurado: $${stopWinAmount.toFixed(2)}`)
        setShowStopDialog(true)
        return
      }

      if (currentProfit <= -stopLossAmount) {
        console.log("[STOP LOSS] Stop Loss atingido! Profit:", currentProfit, "Stop Loss:", -stopLossAmount)
        // Parar o bot imediatamente
        botActiveRef.current = false
        if (botIntervalRef.current) {
          clearInterval(botIntervalRef.current)
          botIntervalRef.current = null
        }
        setBotEnabled(false)
        setBotStats((prev) => ({ ...prev, isRunning: false }))
        // Mostrar popup informando stop loss
        setStopDialogMessage(`Stop Loss atingido! O bot foi desligado automaticamente.\n\nPrejuízo atual: $${Math.abs(currentProfit).toFixed(2)}\nLimite configurado: $${stopLossAmount.toFixed(2)}`)
        setShowStopDialog(true)
        return
      }

      // Verificar novamente se o bot ainda está ativo após verificação de stop win/loss
      if (!botActiveRef.current) {
        console.log("[BOT] Bot foi desativado por stop win/loss. Parando execução.")
        return
      }

      // Calcular o valor do Martingale usando o valor retornado do fetchTrades
      // Se fetchTrades retornou null, usa o consecutiveLosses do estado como fallback
      const lossesCount = tradesData !== null ? tradesData.losses : consecutiveLosses
      const lastLossSymbolFromFetch = tradesData !== null ? tradesData.symbol : lastLossSymbol
      const lastLossDirectionFromFetch = tradesData !== null ? tradesData.direction : lastLossDirection
      const tradeAmount = calculateMartingaleAmount(lossesCount, baseTradeAmount, protections)

      // Se for operação de gale (perdas consecutivas > 0), usa o mesmo ativo e direção da última perda
      // Caso contrário, escolhe um símbolo e direção aleatórios
      let selectedSymbol: string
      let selectedDirection: "BUY" | "SELL"
      
      console.log("[BOT] Verificando símbolo e direção para gale:")
      console.log("[BOT] - lossesCount:", lossesCount)
      console.log("[BOT] - lastLossSymbolFromFetch:", lastLossSymbolFromFetch)
      console.log("[BOT] - lastLossDirectionFromFetch:", lastLossDirectionFromFetch)
      console.log("[BOT] - lastLossSymbol (estado):", lastLossSymbol)
      console.log("[BOT] - lastLossDirection (estado):", lastLossDirection)
      
      if (lossesCount > 0 && lastLossSymbolFromFetch && BOT_SYMBOLS.includes(lastLossSymbolFromFetch) && lastLossDirectionFromFetch) {
        selectedSymbol = lastLossSymbolFromFetch
        selectedDirection = lastLossDirectionFromFetch
        console.log("[BOT] ✅ Operação de GALE detectada - usando mesmo ativo e direção da última perda:")
        console.log("[BOT]    - Símbolo:", selectedSymbol)
        console.log("[BOT]    - Direção:", selectedDirection)
      } else {
        selectedSymbol = BOT_SYMBOLS[Math.floor(Math.random() * BOT_SYMBOLS.length)]
        selectedDirection = Math.random() > 0.5 ? "BUY" : "SELL"
        console.log("[BOT] ⚪ Operação normal - símbolo e direção aleatórios:")
        console.log("[BOT]    - Símbolo:", selectedSymbol)
        console.log("[BOT]    - Direção:", selectedDirection)
        if (lossesCount > 0) {
          console.log("[BOT] ⚠️ ATENÇÃO: Perdas detectadas mas símbolo ou direção não encontrados/inválidos!")
        }
      }

      const timestamp = Date.now()
      
      console.log("[BOT] ============================================")
      console.log("[BOT] Abrindo nova operação:")
      console.log("[BOT] - Símbolo:", selectedSymbol, "| Direção:", selectedDirection)
      console.log("[BOT] - Valor BASE configurado:", baseTradeAmount)
      console.log("[BOT] - Proteções configuradas:", protections)
      console.log("[BOT] - Perdas consecutivas detectadas:", lossesCount)
      console.log("[BOT] - Valor CALCULADO da operação (com Martingale):", tradeAmount)
      console.log("[BOT] - Cálculo:", baseTradeAmount, "× 2^" + lossesCount, "=", tradeAmount)
      if (lossesCount > 0) {
        console.log("[BOT] - Tipo: GALE (proteção) - mesmo ativo e direção da última perda")
      }
      console.log("[BOT] ============================================")
      
      const tradeData = {
        amount: tradeAmount,
        closeType: "01:00" as const,
        expirationType: "CANDLE_CLOSE" as const,
        symbol: selectedSymbol,
        direction: selectedDirection,
        isDemo: Boolean(false), // Explicitly cast to boolean
      }

      const requestBody = JSON.stringify(tradeData)
      console.log("[BOT] REQUEST BODY:", requestBody)

      const response = await fetch("https://broker-api.mybroker.dev/token/trades/open", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-token": apiKey,
          "x-timestamp": timestamp.toString(),
        },
        body: requestBody,
      })

      if (response.ok) {
        const result = await response.json()
        console.log("[v0] Trade opened successfully:", result)

        // Atualizar o tempo da última operação
        lastTradeTimeRef.current = Date.now()

        await fetchTrades()
      } else {
        const errorText = await response.text()
        console.error("[v0] Error opening trade:", response.status, errorText)
      }
    } catch (error) {
      console.error("[v0] Error in bot request:", error)
    }
  }

  const validateBotConfig = () => {
    const errors: string[] = []
    
    if (!baseTradeAmount || baseTradeAmount <= 0) {
      errors.push("Valor de entrada")
    }
    
    if (protections < 0) {
      errors.push("Proteções")
    }
    
    if (!stopWinPercent || stopWinPercent <= 0) {
      errors.push("Stop Win")
    }
    
    if (!stopLossPercent || stopLossPercent <= 0) {
      errors.push("Stop Loss")
    }
    
    return errors
  }

  const toggleBot = () => {
    if (botEnabled) {
      // Stop bot
      botActiveRef.current = false
      if (botIntervalRef.current) {
        clearInterval(botIntervalRef.current)
        botIntervalRef.current = null
      }
      setBotStats((prev) => ({ ...prev, isRunning: false }))
      setBotEnabled(false)
    } else {
      // Validate before starting
      const errors = validateBotConfig()
      
      if (errors.length > 0) {
        setShowValidationDialog(true)
        return
      }
      
      // Start bot
      console.log("[BOT] Iniciando bot...")
      botActiveRef.current = true
      setBotStats((prev) => ({ ...prev, isRunning: true }))
      setBotEnabled(true)
      // Resetar o tempo da última operação para permitir execução imediata
      lastTradeTimeRef.current = 0
      
      // Chamar openAutomaticTrade imediatamente após um pequeno delay para garantir que o estado foi atualizado
      setTimeout(() => {
        if (botActiveRef.current) {
          console.log("[BOT] Chamando openAutomaticTrade() imediatamente após inicialização...")
          openAutomaticTrade()
        }
      }, 500)
      
      // Iniciar intervalo após um delay maior para evitar duplicação com a primeira chamada
      setTimeout(() => {
        if (botActiveRef.current) {
          console.log("[BOT] Criando intervalo de 10 segundos...")
          botIntervalRef.current = setInterval(() => {
            console.log("[BOT] Intervalo executando - botActiveRef:", botActiveRef.current)
            // Verificar se o bot ainda está ativo antes de executar
            if (botActiveRef.current) {
              openAutomaticTrade()
            } else {
              console.log("[BOT] Bot não está ativo no intervalo, pulando execução")
            }
          }, 10000) // Check every 10s
        }
      }, 12000) // Delay de 12 segundos para evitar duplicação com a primeira chamada
    }
  }


  useEffect(() => {
    return () => {
      if (botIntervalRef.current) {
        clearInterval(botIntervalRef.current)
      }
    }
  }, [])

  useEffect(() => {
    // Mostrar popup de boas-vindas ao montar o componente
    setShowWelcomeDialog(true)
  }, [])

  useEffect(() => {
    // Sempre usar modo escuro
    document.documentElement.classList.add("dark")
  }, [])

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("[v0] Service Worker registered:", registration)
        })
        .catch((error) => {
          console.log("[v0] Service Worker registration failed:", error)
        })
    }

    // Limpar operações antigas ao iniciar (sempre começa limpo)
    console.log('[DASHBOARD] Iniciando com operações limpas...')
    sessionStartTimeRef.current = Date.now() // Resetar tempo de sessão
    setActiveTrades([])
    setCompletedTrades([])
    activeTradesCountRef.current = 0
    setConsecutiveLosses(0)
    setBotStats({
      totalTrades: 0,
      wins: 0,
      losses: 0,
      profit: 0,
      isRunning: false,
    })

    // Buscar dados atualizados da API (mas NÃO fetchTrades para manter histórico zerado)
    fetchWalletData()
    fetchCryptoData()
    // fetchTrades() REMOVIDO - histórico fica zerado até o usuário começar a operar

    // Intervalo regular de 30 segundos para atualizar tudo
    const regularInterval = setInterval(() => {
      fetchCryptoData()
      fetchWalletData()
      fetchTrades()
    }, 30000)

    // Intervalo mais frequente (5 segundos) apenas para trades quando há operações ativas ou bot ativo
    const tradesInterval = setInterval(async () => {
      if (activeTrades.length > 0 || botEnabled) {
        console.log("[v0] Atualizando trades - operações ativas:", activeTrades.length, "Bot ativo:", botEnabled)
        const tradesData = await fetchTrades()
        fetchWalletData()
        
        // Verificar stop win/loss após atualizar trades (apenas se o bot estiver ativo)
        if (botEnabled && botActiveRef.current && tradesData !== null) {
          const stopWinAmount = totalBalance * (stopWinPercent / 100)
          const stopLossAmount = totalBalance * (stopLossPercent / 100)
          const currentProfit = tradesData.profit
          
          if (currentProfit >= stopWinAmount) {
            console.log("[STOP WIN] Stop Win atingido no intervalo! Profit:", currentProfit, "Stop Win:", stopWinAmount)
            botActiveRef.current = false
            if (botIntervalRef.current) {
              clearInterval(botIntervalRef.current)
              botIntervalRef.current = null
            }
            setBotEnabled(false)
            setBotStats((prev) => ({ ...prev, isRunning: false }))
            // Mostrar popup informando stop win
            setStopDialogMessage(`Stop Win atingido! O bot foi desligado automaticamente.\n\nLucro atual: $${currentProfit.toFixed(2)}\nLimite configurado: $${stopWinAmount.toFixed(2)}`)
            setShowStopDialog(true)
          } else if (currentProfit <= -stopLossAmount) {
            console.log("[STOP LOSS] Stop Loss atingido no intervalo! Profit:", currentProfit, "Stop Loss:", -stopLossAmount)
            botActiveRef.current = false
            if (botIntervalRef.current) {
              clearInterval(botIntervalRef.current)
              botIntervalRef.current = null
            }
            setBotEnabled(false)
            setBotStats((prev) => ({ ...prev, isRunning: false }))
            // Mostrar popup informando stop loss
            setStopDialogMessage(`Stop Loss atingido! O bot foi desligado automaticamente.\n\nPrejuízo atual: $${Math.abs(currentProfit).toFixed(2)}\nLimite configurado: $${stopLossAmount.toFixed(2)}`)
            setShowStopDialog(true)
          }
        }
      }
    }, 5000)

    return () => {
      clearInterval(regularInterval)
      clearInterval(tradesInterval)
    }
  }, [apiKey, botEnabled])

  return (
    <div className="min-h-screen bg-background animate-in fade-in-0 duration-1000">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="px-6 py-3 rounded-lg bg-gradient-to-b from-blue-400 via-blue-500 to-blue-600 shadow-[0_0_20px_rgba(59,130,246,0.6)] border border-blue-300/40 flex items-center justify-between">
                <h1 className="text-base font-bold text-gray-800 tracking-wider uppercase flex-1 text-center">Vision Trading - The Future</h1>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="text-gray-800 hover:text-gray-900"
                  >
                    <RefreshCwIcon className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onLogout}
                    className="text-gray-800 hover:text-gray-900"
                  >
                    <LogOutIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-8">
        <Card className="border-border/50 overflow-hidden transition-all duration-300 shadow-lg" style={{ backgroundColor: '#020b1a' }}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-white">Saldo Total</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowBalance(!showBalance)}
                  className="text-muted-foreground hover:text-primary"
                >
                  {showBalance ? <EyeIcon className="h-4 w-4" /> : <EyeOffIcon className="h-4 w-4" />}
                </Button>
              </div>
              <div className="flex items-center gap-2 text-green-500">
                <TrendingUpIcon className="h-4 w-4" />
                <span className="text-sm font-medium">+2.5%</span>
              </div>
            </div>

            <div className="mb-6">
              {walletLoading ? (
                <div className="animate-pulse">
                  <div className="h-10 w-48 bg-muted/60 rounded mb-2"></div>
                  <div className="h-4 w-32 bg-muted/60 rounded"></div>
                </div>
              ) : (
                <>
                  <p className="text-3xl md:text-4xl font-bold text-white mb-1">
                    {showBalance
                      ? `$${totalBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                      : "••••••••"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Conta Real conectada
                  </p>
                </>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                className="flex-[0.7] bg-blue-900 hover:bg-blue-800 text-white font-semibold py-8 rounded-lg transition-all duration-300"
                onClick={scrollToTradingSection}
              >
                <ArrowDownIcon className="h-4 w-4 mr-2" />
                Depositar
              </Button>
              <Button
                className="flex-[0.3] bg-transparent border border-blue-500/50 hover:bg-border/20 text-white font-semibold py-8 rounded-lg transition-all duration-300"
                onClick={scrollToTradingSection}
              >
                <ArrowUpIcon className="h-4 w-4 mr-2" />
                Sacar
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 overflow-hidden transition-all duration-300 shadow-lg" style={{ backgroundColor: '#020b1a' }}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <BotIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Inteligência Artificial</h2>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <span className={`h-2 w-2 rounded-full ${botStats.isRunning ? "bg-green-500" : "bg-red-500"}`}></span>
                    {botStats.isRunning ? "Operando automaticamente" : "Parado"}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:gap-4">
                <div className="flex items-center justify-center bg-muted/60 p-3 rounded-lg border border-border/40">
                  <span className="text-sm font-medium text-muted-foreground">Operação: Wallet Real</span>
                </div>

                <Button
                  onClick={toggleBot}
                  className={`w-full ${
                    botEnabled 
                      ? "bg-red-500 hover:bg-red-600" 
                      : isBotConfigValid() 
                        ? "bg-green-500 hover:bg-green-600" 
                        : "bg-gray-500 hover:bg-gray-600"
                  } text-white font-semibold py-3 text-sm whitespace-nowrap`}
                >
                  {botEnabled ? (
                    <>
                      <PauseIcon className="h-4 w-4 mr-2" />
                      Parar IA
                    </>
                  ) : (
                    <>
                      <PlayIcon className="h-4 w-4 mr-2" />
                      Iniciar IA
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-sm font-semibold text-white mb-4 uppercase">Configurações da IA</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-8 rounded-lg border border-border/40" style={{ backgroundColor: '#0a1527', minHeight: '150px' }}>
                  <Label htmlFor="baseTradeAmount" className="text-xs font-medium uppercase block mb-3" style={{ color: '#29384f' }}>
                    Valor Base de Entrada ($)
                  </Label>
                  <Input
                    id="baseTradeAmount"
                    type="text"
                    value={baseTradeAmountInput}
                    onChange={(e) => {
                      const value = e.target.value
                      // Remove tudo que não é número
                      const cleaned = value.replace(/[^0-9]/g, '')
                      setBaseTradeAmountInput(cleaned)
                      const numValue = Number.parseInt(cleaned)
                      if (!isNaN(numValue) && numValue > 0) {
                        setBaseTradeAmount(numValue)
                      }
                    }}
                    onBlur={(e) => {
                      if (baseTradeAmountInput === '' || Number.parseInt(baseTradeAmountInput) <= 0) {
                        setBaseTradeAmountInput("1")
                        setBaseTradeAmount(1)
                      }
                    }}
                    disabled={botEnabled}
                    className="border-0 text-5xl font-bold text-white p-0 h-auto focus-visible:ring-0"
                    style={{ fontSize: '2.4rem', lineHeight: '1.2', backgroundColor: '#0a1527' }}
                  />
                  <p className="text-xs text-muted-foreground mt-3">Valor inicial das operações</p>
                </div>
                <div className="p-8 rounded-lg border border-border/40" style={{ backgroundColor: '#0a1527', minHeight: '150px' }}>
                  <Label htmlFor="protections" className="text-xs font-medium uppercase block mb-3" style={{ color: '#29384f' }}>
                    Proteções (Martingale)
                  </Label>
                  <Input
                    id="protections"
                    type="number"
                    min="0"
                    max="10"
                    step="1"
                    value={protections}
                    onChange={(e) => {
                      const value = e.target.value
                      if (value === "") {
                        setProtections(0)
                        return
                      }

                      const parsed = Number.parseInt(value, 10)
                      if (!Number.isNaN(parsed) && parsed >= 0) {
                        setProtections(parsed)
                      }
                    }}
                    onBlur={(e) => {
                      if (e.target.value === "") {
                        setProtections(0)
                      }
                    }}
                    disabled={botEnabled}
                    className="border-0 text-5xl font-bold text-white p-0 h-auto focus-visible:ring-0"
                    style={{ fontSize: '2.4rem', lineHeight: '1.2', backgroundColor: '#0a1527' }}
                  />
                  <p className="text-xs text-muted-foreground mt-3">
                    {protections === 0 ? "Sem proteção" : `Dobra ${protections}x após loss`}
                  </p>
                </div>
                <div className="p-8 rounded-lg border border-border/40" style={{ backgroundColor: '#0a1527', minHeight: '150px' }}>
                  <Label htmlFor="stopWin" className="text-xs font-medium uppercase block mb-3" style={{ color: '#29384f' }}>
                    Stop Win (% da Banca)
                  </Label>
                  <Input
                    id="stopWin"
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    value={stopWinPercent}
                    onChange={(e) => {
                      const value = e.target.value
                      if (value === "") {
                        setStopWinPercent(1)
                        return
                      }

                      const parsed = Number.parseInt(value, 10)
                      if (!Number.isNaN(parsed) && parsed > 0) {
                        setStopWinPercent(parsed)
                      }
                    }}
                    onBlur={(e) => {
                      if (e.target.value === "") {
                        setStopWinPercent(1)
                      }
                    }}
                    disabled={botEnabled}
                    className="border-0 text-5xl font-bold text-white p-0 h-auto focus-visible:ring-0"
                    style={{ fontSize: '2.4rem', lineHeight: '1.2', backgroundColor: '#0a1527' }}
                  />
                  <p className="text-xs text-muted-foreground mt-3">${((totalBalance * stopWinPercent) / 100).toFixed(2)}</p>
                </div>
                <div className="p-8 rounded-lg border border-border/40" style={{ backgroundColor: '#0a1527', minHeight: '150px' }}>
                  <Label htmlFor="stopLoss" className="text-xs font-medium uppercase block mb-3" style={{ color: '#29384f' }}>
                    Stop Loss (% da Banca)
                  </Label>
                 <Input
                    id="stopLoss"
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    value={stopLossPercent}
                    onChange={(e) => {
                      const value = e.target.value
                      if (value === "") {
                        setStopLossPercent(5)
                        return
                      }

                      const parsed = Number.parseInt(value, 10)
                      if (!Number.isNaN(parsed) && parsed > 0) {
                        setStopLossPercent(parsed)
                      }
                    }}
                    onBlur={(e) => {
                      if (e.target.value === "") {
                        setStopLossPercent(5)
                      }
                    }}
                    disabled={botEnabled}
                    className="border-0 text-5xl font-bold text-white p-0 h-auto focus-visible:ring-0"
                    style={{ fontSize: '2.4rem', lineHeight: '1.2', backgroundColor: '#0a1527' }}
                  />
                  <p className="text-xs text-red-500 mt-3">
                    ${((totalBalance * stopLossPercent) / 100).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-6 p-3 sm:p-4 rounded-lg bg-transparent border border-blue-500/50">
              <div className="text-center p-2">
                <p className="text-xs font-medium text-muted-foreground mb-1 uppercase">Ativos</p>
                <p className="text-xs text-white leading-tight">APPLE, EURGBP, MCD, BTCUSDT, ETHUSDT...</p>
              </div>
              <div className="text-center p-2">
                <p className="text-xs font-medium text-muted-foreground mb-1 uppercase">Valor Atual</p>
                <p className="text-xs text-white">${currentTradeAmount.toFixed(2)}</p>
              </div>
              <div className="text-center p-2">
                <p className="text-xs font-medium text-muted-foreground mb-1 uppercase">Expiração</p>
                <p className="text-xs text-white">1 Minuto</p>
              </div>
              <div className="text-center p-2">
                <p className="text-xs font-medium text-muted-foreground mb-1 uppercase">Lucro/Prejuízo</p>
                <p className={`text-xs font-medium ${botStats.profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                  ${botStats.profit.toFixed(2)}
                </p>
              </div>
            </div>

            <div ref={tradingSectionRef} className="mb-6">
              <h2 className="text-xl font-bold text-primary mb-4">Plataforma de Trading</h2>
              <div className="h-[800px] rounded-lg overflow-hidden border border-border/40">
                <iframe
                  src="https://app.hiove.com/auth/login"
                  title="Hiove Trading Platform"
                  className="w-full h-full"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Operações Realizadas ({activeTrades.length + completedTrades.length})
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {(activeTrades.length === 0 && completedTrades.length === 0) ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhuma operação ainda</p>
                  ) : (
                    <>
                      {/* Operações Pendentes primeiro */}
                      {activeTrades.map((trade) => (
                      <div
                        key={trade.id}
                          className="flex items-center justify-between p-2 rounded bg-yellow-500/10 border border-yellow-500/30"
                      >
                        <div className="flex items-center gap-2">
                            <Badge className="text-xs bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
                              PENDENTE
                            </Badge>
                          <Badge variant={trade.direction === "BUY" ? "default" : "secondary"} className="text-xs">
                            {trade.direction === "BUY" ? "COMPRA" : "VENDA"}
                          </Badge>
                          <span className="text-xs font-medium">{trade.symbol}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-medium">${trade.amount}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(trade.openTime).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                      ))}
                      
                      {/* Operações Finalizadas */}
                      {completedTrades.map((trade) => (
                      <div
                        key={trade.id}
                        className="flex items-center justify-between p-2 rounded bg-muted/60 border border-border/30"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-xs ${trade.status === "WIN" ? "bg-green-500/20 text-green-500 border-green-500/50" : "bg-red-500/20 text-red-500 border-red-500/50"}`}>
                            {trade.status === "WIN" ? "GANHOU" : "PERDEU"}
                          </Badge>
                            <Badge variant={trade.direction === "BUY" ? "default" : "secondary"} className="text-xs">
                            {trade.direction === "BUY" ? "COMPRA" : "VENDA"}
                            </Badge>
                            <span className="text-xs font-medium">{trade.symbol}</span>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-xs font-medium ${
                              trade.result && trade.result > 0 ? "text-green-500" : "text-red-500"
                            }`}
                          >
                            {trade.result ? `$${trade.result.toFixed(2)}` : "$0.00"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {trade.closeTime &&
                              new Date(trade.closeTime).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                          </p>
                        </div>
                      </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 overflow-hidden transition-all duration-300 shadow-lg" style={{ backgroundColor: '#020b1a' }}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-white">Mercado em Tempo Real</h2>
              </div>
              <div className="flex items-center gap-2 text-sm text-green-500">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>Ao Vivo</span>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="border-border/50" style={{ backgroundColor: '#0a1527' }}>
                    <CardContent className="p-4 sm:p-6">
                      <div className="animate-pulse">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="h-10 w-10 bg-muted/60 rounded"></div>
                          <div className="h-4 w-16 bg-muted/60 rounded"></div>
                        </div>
                        <div className="h-6 w-24 bg-muted/60 rounded mb-2"></div>
                        <div className="h-4 w-16 bg-muted/60 rounded"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {cryptoData.map((crypto) => (
                  <CryptoCard key={crypto.id} crypto={crypto} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-8">
          <TransactionHistory apiKey={apiKey} />
        </div>
      </div>

      <AlertDialog open={showValidationDialog} onOpenChange={setShowValidationDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Configuração Incompleta</AlertDialogTitle>
            <AlertDialogDescription>
              Por favor, preencha todas as informações antes de iniciar a IA:
              <ul className="mt-2 list-disc list-inside">
                {validateBotConfig().map((error, index) => (
                  <li key={index} className="text-destructive">{error}</li>
                ))}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowValidationDialog(false)}>
              Entendi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showWelcomeDialog} onOpenChange={setShowWelcomeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Bem-vindo ao Vision Academy!</AlertDialogTitle>
            <AlertDialogDescription>
              Antes de iniciar a operação automática com a Inteligência Artificial, você precisa configurar:
              <ul className="mt-4 space-y-2 list-disc list-inside">
                <li className="text-white">
                  <strong className="text-white">Valor de Entrada:</strong> O valor inicial de cada operação
                </li>
                <li className="text-white">
                  <strong className="text-white">Proteções:</strong> Número de proteções Martingale (dobro após cada perda)
                </li>
                <li className="text-white">
                  <strong className="text-white">Stop Win:</strong> Porcentagem da banca para parar após ganhos
                </li>
                <li className="text-white">
                  <strong className="text-white">Stop Loss:</strong> Porcentagem da banca para parar após perdas
                </li>
              </ul>
              <p className="mt-4 text-sm text-muted-foreground">
                Configure essas opções na seção de Configurações da IA antes de iniciar.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction 
              onClick={() => setShowWelcomeDialog(false)}
              className="gradient-silver hover:gradient-silver-hover text-primary-foreground"
            >
              Entendi, vou configurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showStopDialog} onOpenChange={setShowStopDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bot Desligado Automaticamente</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {stopDialogMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction 
              onClick={() => setShowStopDialog(false)}
              className={stopDialogMessage.includes("Stop Win") 
                ? "bg-green-500 hover:bg-green-600 text-white" 
                : "bg-red-500 hover:bg-red-600 text-white"}
            >
              Entendi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
