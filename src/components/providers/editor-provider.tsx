import type { FunctionComponent, ReactNode } from "react"

type EditorProviderProps = Readonly<{
  children: ReactNode
}>
const EditorProvider: FunctionComponent<EditorProviderProps> = ({ children }) => {
  return (
    <div>
      {children}
    </div>
  )
}

export default EditorProvider
