// src/domain/fees.service.js
const feeGrid = require('../config/fees.config.json');

/**
 * Calcule les frais et le total débité selon la grille tarifaire (EF-12).
 * @param {number} amount Montant en XOF
 * @returns {{ fee: number, total: number }}
 */
function calculateFee(amount) {
  if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
    throw new Error('Le montant doit être un nombre positif');
  }

  const gridItem = feeGrid.find(
    (tier) => amount >= tier.min_amount && amount <= tier.max_amount
  );

  // Si au-delà de la grille, palier max
  const fee = gridItem ? gridItem.fee : feeGrid[feeGrid.length - 1].fee;
  const total = amount + fee;

  return { fee, total };
}

module.exports = { calculateFee };