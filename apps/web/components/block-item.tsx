'use client'

import dynamic from 'next/dynamic'

//The dynamic import is to prevent the command component from being rendered on the server and cause hydration errors
const Command = dynamic(() => import('./command').then((mod) => mod.Command), { ssr: false })

interface BlockItemProps {
  name: string
}

export const BlockItem = ({ name }: BlockItemProps) => {
  return (
    <div className="mt-4">
      <Command name={name} highlight />
    </div>
  )
}

export const BlockItemPreview = ({ title, src }: { title: string; src: string }) => {
  return (
    <div className="flex items-center justify-center relative border rounded-lg">
      <iframe src={src} className="w-full h-[600px] border-0 rounded-md" title={title} />
    </div>
  )
}
