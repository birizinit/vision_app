"use client"

import { Card, CardContent } from "@/components/ui/card"
import Image from "next/image"

interface CryptoData {
  id: string
  symbol: string
  name: string
  current_price: number
  price_change_percentage_24h: number
  image: string
}

interface CryptoCardProps {
  crypto: CryptoData
}

export function CryptoCard({ crypto }: CryptoCardProps) {
  const isPositive = crypto.price_change_percentage_24h > 0
  const changeColor = isPositive ? "text-green-500" : "text-red-500"

  return (
    <Card className="border-border/50 transition-all duration-300 hover:scale-105" style={{ backgroundColor: '#0a1527' }}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 rounded overflow-hidden">
              <Image src={crypto.image || "/placeholder.svg"} alt={crypto.name} fill className="object-cover" />
            </div>
            <div>
              <p className="font-semibold text-white">{crypto.symbol.toUpperCase()}</p>
              <p className="text-sm text-muted-foreground">{crypto.symbol.toUpperCase()}/USD</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-2xl font-bold text-white">
            $
            {crypto.current_price.toLocaleString("en-US", {
              minimumFractionDigits: crypto.current_price < 1 ? 4 : 2,
              maximumFractionDigits: crypto.current_price < 1 ? 4 : 2,
            })}
          </p>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${changeColor}`}>
              {isPositive ? "+" : ""}
              {crypto.price_change_percentage_24h.toFixed(2)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
