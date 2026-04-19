import apiClient from '../../config/apiClient.js'

export const memorialApi = {
  getMemorial: (slug) =>
    apiClient.get(`/memorial/${slug}`),
}
