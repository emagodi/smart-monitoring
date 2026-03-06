import { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';

interface Option {
  id: number | string;
  name: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: number | string | '';
  onChange: (value: any) => void;
  placeholder?: string;
  compact?: boolean;
}

export const SearchableSelect = ({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  compact = false,
}: SearchableSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.id === value);
  const filteredOptions = options.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex w-full items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm shadow-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:ring-offset-gray-900 ${
          compact ? 'h-9' : 'h-10'
        } ${!selectedOption ? 'text-gray-500' : ''}`}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:border-gray-700 dark:bg-gray-800 sm:text-sm">
          <div className="sticky top-0 border-b bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
            <div className="relative flex items-center">
              <Search className="absolute left-2 h-4 w-4 text-gray-500" />
              <input
                type="text"
                className="w-full rounded-md border border-gray-200 bg-gray-50 py-1 pl-8 pr-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          {filteredOptions.length === 0 ? (
            <div className="px-4 py-2 text-sm text-gray-500">No results found.</div>
          ) : (
            filteredOptions.map((option) => (
              <div
                key={option.id}
                className={`relative cursor-default select-none py-2 pl-3 pr-9 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                  option.id === value ? 'bg-gray-50 dark:bg-gray-700/50' : ''
                }`}
                onClick={() => {
                  onChange(option.id);
                  setIsOpen(false);
                  setSearch('');
                }}
              >
                <span className={`block truncate ${option.id === value ? 'font-semibold' : 'font-normal'}`}>
                  {option.name}
                </span>
                {option.id === value && (
                  <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-brand-600 dark:text-brand-400">
                    <Check className="h-4 w-4" />
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
