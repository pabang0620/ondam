import apiClient from '../../config/apiClient.js'

export const postRegister = async ({ email, password, nickname, consents }) => {
  const { data } = await apiClient.post('/auth/register', {
    email,
    password,
    nickname,
    consents,
  })
  return data.data // { accessToken, user }
}
