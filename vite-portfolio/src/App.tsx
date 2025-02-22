import { useState } from "react";

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-8">Hello world!</h1>

        <div className="space-y-6">
          <button
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg 
                       font-semibold transition-colors duration-200 shadow-sm"
            onClick={() => setCount(count + 1)}
          >
            Click me
          </button>

          <p className="text-2xl font-medium text-gray-700">
            Count is <span className="text-blue-500">{count}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
