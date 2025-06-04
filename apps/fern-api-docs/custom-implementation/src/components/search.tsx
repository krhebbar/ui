export const Search = () => {
  return (
    <button
      id="fern-search-button"
      className="fern-search-bar w-full"
      style={{ marginBottom: '8px' }}
      onClick={() => {
        if ((window as any).plugSDK) {
          (window as any).plugSDK.toggleSearchAgent()
        }
      }}>
      <span className="search-placeholder">
        <svg
          width="1.5em"
          height="1.5em"
          viewBox="0 0 24 24"
          strokeWidth="1.5"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          color="currentColor"
          className="size-icon-md">
          <path
            d="M17 17L21 21"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"></path>
          <path
            d="M3 11C3 15.4183 6.58172 19 11 19C13.213 19 15.2161 18.1015 16.6644 16.6493C18.1077 15.2022 19 13.2053 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"></path>
        </svg>
        <span>Search...</span>
      </span>
      <kbd className="keyboard-shortcut-hint">/</kbd>
    </button>
  )
}
