'use client'

import {
  ComponentConfigContext,
  FooterV30 as SharedFooter,
} from '@devrev/marketing-shared-components/dist/cjs'

import './footer.css'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Footer = ({ list = [], logo, status, compliance, ...rest }: any) => {
  // Footer
  return (
    <ComponentConfigContext.Provider
      value={{
        origin: 'https://developer.devrev.ai',
      }}>
      <SharedFooter
        className="custom-footer"
        list={list}
        logo={logo}
        status={status}
        compliance={compliance}
        {...rest}
      />
    </ComponentConfigContext.Provider>
  )
}

export default Footer
