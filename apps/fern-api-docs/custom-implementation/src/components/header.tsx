'use client'

import { useEffect, useState } from 'react'
import {
  ComponentConfigContext,
  HeaderV30 as SharedHeader,
} from '@devrev/marketing-shared-components/dist/cjs'

import './header.css'

const Header = ({
  logo,
  links,
  actions,
  collapseOnScroll = true,
}: // eslint-disable-next-line @typescript-eslint/no-explicit-any
any) => {
  const html = document.getElementsByTagName('html')[0]
  const [theme, setTheme] = useState(html.getAttribute('class'))
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(html.getAttribute('class'))
    })

    const config = { attributes: true, attributeFilter: ['class'] }
    observer.observe(html, config)
    return () => {
      observer.disconnect()
    }
  }, [html])

  return (
    <div>
      <ComponentConfigContext.Provider
        value={{
          origin: 'https://developer.devrev.ai',
        }}>
        <SharedHeader
          logo={logo}
          items={links}
          actions={actions}
          version={theme === 'dark' ? 'light' : 'dark'}
          collapseOnScroll={collapseOnScroll}
          wrapperClassName="custom-header"
        />
      </ComponentConfigContext.Provider>
    </div>
  )
}

export default Header
