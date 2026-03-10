import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface Item {
  id: number;
  name: string;
  description: string;
  created_at: string;
}

const ItemList: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const { token } = useAuth();

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/items/`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setItems(data);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/items/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, description }),
      });
      
      if (response.ok) {
        const newItem = await response.json();
        setItems([...items, newItem]);
        setName('');
        setDescription('');
      }
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  return (
    <div className="items-container">
      <h1>Item Management</h1>
      
      <form onSubmit={handleSubmit} className="item-form">
        <div>
          <label htmlFor="name">Name:</label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="description">Description:</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>
        <button type="submit">Add Item</button>
      </form>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="items-list">
          <h2>Items ({items.length})</h2>
          {items.map(item => (
            <div key={item.id} className="item-card">
              <h3>{item.name}</h3>
              <p>{item.description}</p>
              <small>Created: {new Date(item.created_at).toLocaleString()}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ItemList;