import { useState } from 'react';
import SamplePage from './SamplePage';
import './App.css';

function App() {
  const [count, setCount] = useState(0)

  return (
    <div>
      <SamplePage />
    </div>
  );
}

export default App;
