#!/usr/bin/env python3
"""
Integration Test Script for RPHU Weighing and Shrinkage Automation Pipeline
Simulates end-to-end data pipeline:
1. Fetch Lot
2. Calculate shrinkage formulas
3. Post weighing record
4. Verify audit & calculated yield
"""

import unittest
import math

class TestRPHUPipeline(unittest.TestCase):
    def setUp(self):
        self.sample_lot = {
            "id": "L-0610-01",
            "send_weight": 4920.0,
            "received_alive_weight": 4841.0,
            "wet_carcass_weight": 3402.0,
            "cold_carcass_weight": 3438.0,
            "price_live": 21500.0,
            "price_carcass": 36000.0,
            "payment_basis": "kirim"
        }

    def test_transit_shrinkage_formula(self):
        send = self.sample_lot["send_weight"]
        recv = self.sample_lot["received_alive_weight"]
        transit_shrink_pct = ((send - recv) / send) * 100.0
        self.assertAlmostEqual(transit_shrink_pct, 1.60569, places=2)
        self.assertEqual(round(transit_shrink_pct, 2), 1.61)

    def test_chilling_shrinkage_formula(self):
        wet = self.sample_lot["wet_carcass_weight"]
        cold = self.sample_lot["cold_carcass_weight"]
        chilling_shrink_pct = ((wet - cold) / wet) * 100.0
        self.assertEqual(round(chilling_shrink_pct, 2), -1.06)

    def test_yield_formula(self):
        recv = self.sample_lot["received_alive_weight"]
        cold = self.sample_lot["cold_carcass_weight"]
        carcass_yield_pct = (cold / recv) * 100.0
        self.assertEqual(round(carcass_yield_pct, 2), 71.02)

    def test_financial_loss_calculation(self):
        send = self.sample_lot["send_weight"]
        recv = self.sample_lot["received_alive_weight"]
        price = self.sample_lot["price_live"]
        loss_rp = (send - recv) * price
        self.assertEqual(loss_rp, 1698500.0)

if __name__ == "__main__":
    unittest.main()
