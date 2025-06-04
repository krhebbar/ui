import { createClient } from '@sanity/client'
import { FOOTER_V3_SCHEMA, HEADER_V3_SCHEMA } from './schema'

export const CLIENT = createClient({
  projectId: 'umrbtih2',
  dataset: 'production',
  apiVersion: '2022-03-25',
  useCdn: true,
})

export const SANITY_TYPES = {
  PAGE_CONTENT: 'pageContent',
} as const

export const getPageData = async (): Promise<{
  header: object
  footer: object
  plug: { id: string }
}> => {
  const header = await CLIENT.fetch(
    `*[_type == 'headerV2' && slug.current == 'developer']{
        ${HEADER_V3_SCHEMA}
      }[0]`,
  )

  const footer = await CLIENT.fetch(
    `*[_type == 'footerV2' && slug.current == 'default']{
        ${FOOTER_V3_SCHEMA}
      }[0]`,
  )

  const plug = await CLIENT.fetch(
    `*[_type == 'externalLink' && slug.current == 'devrev-plug-app-id']{
         "id": href
      }[0]`,
  )

  return { header, footer, plug }
}
