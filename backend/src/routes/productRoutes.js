const express = require('express')
const productController = require('../controllers/productController')
const { authenticateToken, authorizeRoles } = require('../middleware/auth')
const { parseProductImage } = require('../middleware/productImageUpload')

const router = express.Router()
router.get('/', productController.getProducts)
router.post('/id/:productId/image', authenticateToken, authorizeRoles('ADMIN', 'INVENTORY'), parseProductImage, productController.uploadProductImage)
router.put('/id/:productId/image-url', authenticateToken, authorizeRoles('ADMIN', 'INVENTORY'), productController.setProductImageUrl)
router.delete('/id/:productId/image', authenticateToken, authorizeRoles('ADMIN', 'INVENTORY'), productController.removeProductImage)
router.get('/:productCode/image', productController.getProductImage)
router.get('/:productCode', productController.getProductByCode)

module.exports = router
