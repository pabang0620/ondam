import apiClient from '../../config/apiClient.js'

export const postLogin = async ({ email, password }) => {
  const { data } = await apiClient.post('/auth/login', { email, password })
  return data.data // { accessToken, user }
}
