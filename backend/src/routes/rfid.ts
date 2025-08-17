import { Router } from 'express';

const router = Router();

interface RFIDCard {
  id: string;
  name: string;
  playlistId?: string;
  action: 'play_playlist' | 'stop' | 'volume_up' | 'volume_down';
  createdAt: Date;
}

let rfidCards: RFIDCard[] = [];

router.get('/cards', (req, res) => {
  res.json({ cards: rfidCards });
});

router.post('/cards', (req, res) => {
  const { id, name, playlistId, action } = req.body;
  
  const existingCardIndex = rfidCards.findIndex(card => card.id === id);
  const card: RFIDCard = {
    id,
    name,
    playlistId,
    action,
    createdAt: new Date()
  };

  if (existingCardIndex >= 0) {
    rfidCards[existingCardIndex] = card;
  } else {
    rfidCards.push(card);
  }

  res.json(card);
});

router.delete('/cards/:id', (req, res) => {
  const { id } = req.params;
  rfidCards = rfidCards.filter(card => card.id !== id);
  res.json({ success: true });
});

router.post('/scan', (req, res) => {
  const { cardId } = req.body;
  const card = rfidCards.find(c => c.id === cardId);
  
  if (!card) {
    return res.status(404).json({ error: 'Card not found' });
  }

  res.json({ card, action: card.action });
});

export default router;