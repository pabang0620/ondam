import * as photoService from './photoService.js'
import { created, success, paginated } from '../../utils/response.js'

export const createOrder = async (req, res, next) => {
  try {
    const { userId } = req.user
    const data = await photoService.createOrder(userId, req.body)
    return created(res, data, '사진 주문이 생성되었습니다')
  } catch (err) {
    next(err)
  }
}

export const getOrders = async (req, res, next) => {
  try {
    const { userId } = req.user
    const { page, limit } = req.query
    const { orders, meta } = await photoService.getOrders(userId, { page, limit })
    return paginated(res, orders, meta)
  } catch (err) {
    next(err)
  }
}

export const getOrder = async (req, res, next) => {
  try {
    const { userId } = req.user
    const { orderId } = req.params
    const order = await photoService.getOrder(userId, orderId)
    return success(res, order)
  } catch (err) {
    next(err)
  }
}

export const getJobStatus = async (req, res, next) => {
  try {
    const { userId } = req.user
    const { orderId } = req.params
    const status = await photoService.getJobStatus(orderId, userId)
    return success(res, status)
  } catch (err) {
    next(err)
  }
}

export const getResult = async (req, res, next) => {
  try {
    const { userId } = req.user
    const { orderId } = req.params
    const result = await photoService.getResult(orderId, userId)
    return success(res, result)
  } catch (err) {
    next(err)
  }
}

export const retryOrder = async (req, res, next) => {
  try {
    const { userId } = req.user
    const { orderId } = req.params
    const data = await photoService.retryOrder(orderId, userId)
    return success(res, data, '재처리가 시작되었습니다')
  } catch (err) {
    next(err)
  }
}
