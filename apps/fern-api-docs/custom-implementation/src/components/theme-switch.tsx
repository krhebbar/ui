import React, { useEffect } from 'react'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

export const ThemeSwitch = () => {
  const [selected, setSelected] = React.useState('public')

  useEffect(() => {
    const beta = window.location.pathname.split('/').includes('beta')
    setSelected(beta ? 'beta' : 'public')
  }, [])

  return (
    <div className="mt-2">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            className="fern-button outlined normal primary"
            style={{
              width: '100%',
            }}>
            <span
              className="fern-button-content"
              style={{
                width: '100%',
                justifyContent: 'space-between',
              }}>
              <span className="fern-button-text">
                {selected === 'beta' ? 'Beta' : 'Public'}
              </span>
              <svg
                width="15"
                height="15"
                viewBox="0 0 15 15"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="transition-transform data-[state=open]:rotate-180">
                <path
                  d="M4.18179 6.18181C4.35753 6.00608 4.64245 6.00608 4.81819 6.18181L7.49999 8.86362L10.1818 6.18181C10.3575 6.00608 10.6424 6.00608 10.8182 6.18181C10.9939 6.35755 10.9939 6.64247 10.8182 6.81821L7.81819 9.81821C7.73379 9.9026 7.61934 9.95001 7.49999 9.95001C7.38064 9.95001 7.26618 9.9026 7.18179 9.81821L4.18179 6.81821C4.00605 6.64247 4.00605 6.35755 4.18179 6.18181Z"
                  fill="currentColor"
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                />
              </svg>
            </span>
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="fern-dropdown"
            style={{
              marginTop: '4px',
              border: 'rgba(93, 101, 238, 0.4) 1px solid',
            }}>
            <DropdownMenu.RadioGroup
              value={selected}
              onValueChange={setSelected}>
              <DropdownMenu.RadioItem value="public">
                <a className="fern-dropdown-item" href="/about/for-developers">
                  <span
                    style={{
                      marginRight: 'auto',
                    }}>
                    <span>Public</span>
                  </span>
                  <DropdownMenu.ItemIndicator className="fern-dropdown-item-indicator">
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 15 15"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L7.39799 11.092C7.29783 11.2452 7.13556 11.3467 6.95402 11.3699C6.77247 11.3931 6.58989 11.3355 6.45446 11.2124L3.70446 8.71241C3.44905 8.48022 3.43023 8.08494 3.66242 7.82953C3.89461 7.57412 4.28989 7.55529 4.5453 7.78749L6.75292 9.79441L10.6018 3.90792C10.7907 3.61902 11.178 3.53795 11.4669 3.72684Z"
                        fill="currentColor"
                        fill-rule="evenodd"
                        clip-rule="evenodd"></path>
                    </svg>
                  </DropdownMenu.ItemIndicator>
                </a>
              </DropdownMenu.RadioItem>
              <DropdownMenu.RadioItem value="beta">
                <a
                  className="fern-dropdown-item"
                  style={{
                    justifyContent: 'space-between',
                  }}
                  href="/beta/about/for-developers">
                  <span
                    style={{
                      marginRight: 'auto',
                    }}>
                    <span>Beta</span>
                  </span>
                  <DropdownMenu.ItemIndicator className="fern-dropdown-item-indicator">
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 15 15"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L7.39799 11.092C7.29783 11.2452 7.13556 11.3467 6.95402 11.3699C6.77247 11.3931 6.58989 11.3355 6.45446 11.2124L3.70446 8.71241C3.44905 8.48022 3.43023 8.08494 3.66242 7.82953C3.89461 7.57412 4.28989 7.55529 4.5453 7.78749L6.75292 9.79441L10.6018 3.90792C10.7907 3.61902 11.178 3.53795 11.4669 3.72684Z"
                        fill="currentColor"
                        fill-rule="evenodd"
                        clip-rule="evenodd"></path>
                    </svg>
                  </DropdownMenu.ItemIndicator>
                </a>
              </DropdownMenu.RadioItem>
            </DropdownMenu.RadioGroup>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  )
}
