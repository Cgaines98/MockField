import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Deck, DeckCard } from '../types';
import { scryfallService, deckService } from '../services/api';
import { Search, Save, Trash2, Plus, Minus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const DeckEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [deck, setDeck] = useState<Deck>({ name: 'New Deck', format: 'Standard', mainboard: [], sideboard: [], cards: [] });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Card[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [hoverCard, setHoverCard] = useState<Card | DeckCard | null>(null);

  useEffect(() => {
    if (id && id !== 'new' && token) {
      deckService.getDeck(id).then(setDeck);
    }
  }, [id, token]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    try {
      const results = await scryfallService.searchCards(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed', error);
    }
  };

  const addCard = async (card: Card) => {
    // Handle cards without top-level image_uris (like double-faced cards)
    let finalImageUris = card.image_uris;
    if (!finalImageUris && card.card_faces && card.card_faces.length > 0) {
      finalImageUris = card.card_faces[0].image_uris;
    }

    const cards = deck.cards || [];
    const existing = cards.find(c => c.oracle_id === card.oracle_id);
    const newQuantity = existing ? existing.quantity + 1 : 1;
    
    // Create a copy of the card with the processed image_uris
    const processedCard = { ...card, image_uris: finalImageUris };
    
    const deckCard: DeckCard = existing 
      ? { ...existing, quantity: newQuantity }
      : { ...processedCard, quantity: 1 };

    if (deck.id) {
      try {
        const updatedDeck = await deckService.upsertCard(deck.id, deckCard);
        setDeck(updatedDeck);
      } catch (error) {
        console.error('Failed to add card to backend', error);
      }
    } else {
      // Local update if deck not saved yet
      if (existing) {
        setDeck({
          ...deck,
          cards: cards.map(c => c.oracle_id === card.oracle_id ? { ...c, quantity: newQuantity } : c)
        });
      } else {
        setDeck({
          ...deck,
          cards: [...cards, { ...card, quantity: 1 }]
        });
      }
    }
  };

  const updateQuantity = async (cardId: string, delta: number) => {
    const cards = deck.cards || [];
    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    const newQty = Math.max(0, card.quantity + delta);

    if (deck.id) {
      try {
        let updatedDeck;
        if (newQty === 0) {
          updatedDeck = await deckService.removeCard(deck.id, card.oracle_id);
        } else {
          updatedDeck = await deckService.upsertCard(deck.id, { ...card, quantity: newQty });
        }
        setDeck(updatedDeck);
      } catch (error) {
        console.error('Failed to update quantity in backend', error);
      }
    } else {
      // Local update
      setDeck({
        ...deck,
        cards: cards.map(c => {
          if (c.id === cardId) {
            return { ...c, quantity: newQty };
          }
          return c;
        }).filter(c => c.quantity > 0)
      });
    }
  };

  const saveDeck = async () => {
    try {
      if (deck.id) {
        await deckService.updateDeck(deck.id, deck);
      } else {
        const newDeck = await deckService.createDeck(deck);
        // If there were local cards, we should save them too
        if (deck.cards && deck.cards.length > 0) {
          for (const card of deck.cards) {
            await deckService.upsertCard(newDeck.id!, card);
          }
        }
      }
      navigate('/');
    } catch (error) {
      alert('Failed to save deck. Is the backend running?');
    }
  };

  const deleteDeck = async () => {
    if (!deck.id) return;
    if (window.confirm(`Are you sure you want to delete "${deck.name}"?`)) {
      try {
        await deckService.deleteDeck(deck.id);
        navigate('/');
      } catch (error) {
        console.error('Failed to delete deck', error);
        alert('Failed to delete deck');
      }
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px 250px', gap: '30px', position: 'relative' }}>
      <div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <input
              style={{ fontSize: '1.5rem', background: 'transparent', border: 'none', borderBottom: '1px solid #333', flexGrow: 1 }}
              value={deck.name}
              onChange={e => setDeck({ ...deck, name: e.target.value })}
            />
            <div style={{ display: 'flex', gap: '10px', marginLeft: '20px' }}>
              <div style={{ display: 'flex', background: '#2a2a2a', borderRadius: '4px', padding: '2px' }}>
                <button 
                  onClick={() => setViewMode('list')}
                  style={{ 
                    padding: '4px 12px', 
                    fontSize: '0.8rem',
                    background: viewMode === 'list' ? '#3d5afe' : 'transparent',
                    borderRadius: '2px'
                  }}
                >
                  List
                </button>
                <button 
                  onClick={() => setViewMode('grid')}
                  style={{ 
                    padding: '4px 12px', 
                    fontSize: '0.8rem',
                    background: viewMode === 'grid' ? '#3d5afe' : 'transparent',
                    borderRadius: '2px'
                  }}
                >
                  Visual
                </button>
              </div>
              <button onClick={saveDeck} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Save size={18} /> Save Deck
              </button>
              {deck.id && (
                <button onClick={deleteDeck} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f44336' }}>
                  <Trash2 size={18} /> Delete
                </button>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label htmlFor="format-select">Format:</label>
            <select
              id="format-select"
              value={deck.format}
              onChange={e => setDeck({ ...deck, format: e.target.value })}
              style={{ padding: '5px', background: '#333', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}
            >
              <option value="Standard">Standard</option>
              <option value="Commander">Commander</option>
              <option value="Modern">Modern</option>
              <option value="Pioneer">Pioneer</option>
              <option value="Legacy">Legacy</option>
              <option value="Vintage">Vintage</option>
              <option value="Pauper">Pauper</option>
            </select>
          </div>
        </div>

        <div className={viewMode === 'list' ? 'card-list' : 'card-grid'}>
          {(deck.cards?.length || 0) === 0 && <p>No cards in deck. Use search to add some!</p>}
          {deck.cards?.map(card => (
            viewMode === 'list' ? (
              <div 
                key={card.id} 
                className="card-item" 
                style={{ gap: '15px' }}
                onMouseEnter={() => setHoverCard(card)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                  {card.image_uris && (
                    <img 
                      src={card.image_uris.small} 
                      alt={card.name} 
                      style={{ width: '40px', borderRadius: '2px' }} 
                    />
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 'bold' }}>{card.quantity}x</span>
                      <span style={{ fontWeight: 500 }}>{card.name}</span>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: '#aaa' }}>{card.type_line}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <span style={{ fontSize: '0.9rem', fontFamily: 'monospace' }}>{card.mana_cost}</span>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button onClick={() => updateQuantity(card.id, -1)} style={{ padding: '4px 8px', background: '#444' }}><Minus size={14} /></button>
                    <button onClick={() => updateQuantity(card.id, 1)} style={{ padding: '4px 8px', background: '#444' }}><Plus size={14} /></button>
                    <button onClick={() => updateQuantity(card.id, -card.quantity)} style={{ padding: '4px 8px', background: '#f44336' }}><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            ) : (
              <div key={card.id} className="grid-card-item" onMouseEnter={() => setHoverCard(card)}>
                <div style={{ position: 'relative' }}>
                  {card.image_uris ? (
                    <img 
                      src={card.image_uris.normal} 
                      alt={card.name} 
                      style={{ width: '100%', borderRadius: '8px', display: 'block' }} 
                    />
                  ) : (
                    <div style={{ width: '100%', aspectRatio: '0.714', background: '#333', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {card.name}
                    </div>
                  )}
                  <div className="grid-card-overlay">
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button onClick={() => updateQuantity(card.id, -1)} style={{ padding: '4px', background: 'rgba(0,0,0,0.7)' }}><Minus size={14} /></button>
                      <button onClick={() => updateQuantity(card.id, 1)} style={{ padding: '4px', background: 'rgba(0,0,0,0.7)' }}><Plus size={14} /></button>
                    </div>
                  </div>
                  <div className="grid-card-quantity">{card.quantity}</div>
                </div>
                <div style={{ padding: '5px 0', fontSize: '0.8rem', textAlign: 'center', fontWeight: 500 }}>
                  {card.name}
                </div>
              </div>
            )
          ))}
        </div>
      </div>

      <div style={{ background: '#1f1f1f', padding: '20px', borderRadius: '8px', border: '1px solid #333' }}>
        <h3>Search Cards</h3>
        <form onSubmit={handleSearch} className="search-container">
          <input
            placeholder="Search Scryfall..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <button type="submit"><Search size={18} /></button>
        </form>

        <div style={{ maxHeight: '600px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {searchResults.map(card => (
            <div
              key={card.id}
              className="card-item"
              style={{ cursor: 'pointer', fontSize: '0.9rem', gap: '10px' }}
              onClick={() => addCard(card)}
              onMouseEnter={() => setHoverCard(card)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                {(card.image_uris || (card.card_faces && card.card_faces[0].image_uris)) && (
                  <img 
                    src={card.image_uris?.small || card.card_faces?.[0].image_uris?.small} 
                    alt={card.name} 
                    style={{ width: '30px', borderRadius: '2px' }} 
                  />
                )}
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <span style={{ fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {card.name}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#aaa' }}>{card.mana_cost}</span>
                </div>
              </div>
              <Plus size={14} />
            </div>
          ))}
        </div>
      </div>

      {/* Card Display Window */}
      <div style={{ position: 'sticky', top: '20px', height: 'fit-content' }}>
        <div style={{ 
          background: '#1f1f1f', 
          padding: '15px', 
          borderRadius: '8px', 
          border: '1px solid #333',
          minHeight: '350px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '250px'
        }}>
          {hoverCard ? (
            <div>
              <img 
                src={hoverCard.image_uris?.normal || hoverCard.card_faces?.[0]?.image_uris?.normal} 
                alt={hoverCard.name} 
                style={{ width: '100%', borderRadius: '8px', display: 'block', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }}
              />
              <div style={{ marginTop: '10px', textAlign: 'center' }}>
                <div style={{ fontWeight: 'bold' }}>{hoverCard.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#aaa' }}>{hoverCard.type_line}</div>
              </div>
            </div>
          ) : (
            <div style={{ color: '#666', textAlign: 'center' }}>
              Hover over a card to see preview
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeckEditor;
