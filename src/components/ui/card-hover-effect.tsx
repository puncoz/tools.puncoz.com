"use client"
import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "framer-motion"
import Link from "next/link"
import React, { type FunctionComponent, useState } from "react"

type HoverEffectProps = Readonly<{
  items: {
    title: string;
    description: string;
    link: string;
  }[];
  className?: string;
}>
export const HoverEffect: FunctionComponent<HoverEffectProps> = ({ items, className }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  return (
    <div className={cn(
      "grid grid-cols-1 md:grid-cols-2  lg:grid-cols-3  py-10",
      className,
    )}>
      {items.map((item, idx) => (
        <Link href={item?.link}
              key={item?.link}
              className="relative group  block p-2 h-full w-full"
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}>
          <AnimatePresence>
            {hoveredIndex === idx && (
              <motion.span
                className="absolute inset-0 h-full w-full bg-neutral-200 dark:bg-slate-800/[0.8] block  rounded-3xl"
                layoutId="hoverBackground"
                initial={{ opacity: 0 }}
                animate={{
                  opacity: 1,
                  transition: { duration: 0.15 },
                }}
                exit={{
                  opacity: 0,
                  transition: { duration: 0.15, delay: 0.2 },
                }}
              />
            )}
          </AnimatePresence>
          <Card>
            <CardTitle>{item.title}</CardTitle>
            <CardDescription>{item.description}</CardDescription>
          </Card>
        </Link>
      ))}
    </div>
  )
}

type CardProps = Readonly<{
  className?: string;
  children: React.ReactNode;
}>
export const Card: FunctionComponent<CardProps> = ({ className, children }) => {
  return (
    <div className={cn(
      "rounded-2xl h-full w-full p-4 overflow-hidden bg-black border border-transparent dark:border-white/[0.2] group-hover:border-slate-700 relative z-20",
      className,
    )}>
      <div className="relative z-50">
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

type CardTitleProps = Readonly<{
  className?: string;
  children: React.ReactNode;
}>
export const CardTitle: FunctionComponent<CardTitleProps> = ({ className, children }) => {
  return (
    <h4 className={cn("text-zinc-100 font-bold tracking-wide mt-4", className)}>
      {children}
    </h4>
  )
}

type CardDescriptionProps = Readonly<{
  className?: string;
  children: React.ReactNode
}>
export const CardDescription: FunctionComponent<CardDescriptionProps> = ({ className, children }) => {
  return (
    <p className={cn(
      "mt-8 text-zinc-400 tracking-wide leading-relaxed text-sm",
      className,
    )}>
      {children}
    </p>
  )
}
