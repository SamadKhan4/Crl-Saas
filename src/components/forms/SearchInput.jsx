import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
export default function SearchInput({ value = '', onChange, placeholder = 'Search records…' }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (text === value) return;
    const timer = setTimeout(() => onChange(text), 350);
    return () => clearTimeout(timer);
  }, [text, value, onChange]);
  return (
    <div className="search-input">
      <Search size={17} />
      <input
        aria-label={placeholder}
        value={text}
        maxLength={100}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
