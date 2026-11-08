import OysterFinder from "./finder/OysterFinder"
import FinderBoundary from "./finder/FinderBoundary"

export default function App() {
  return (
    <main>
      <FinderBoundary>
        <OysterFinder />
      </FinderBoundary>
    </main>
  )
}
