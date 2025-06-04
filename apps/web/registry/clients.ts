import { type Registry } from 'shadcn/registry'
import nextjs from './default/clients/nextjs/registry-item.json' with { type: 'json' }

export const clients = [nextjs] as Registry['items']
