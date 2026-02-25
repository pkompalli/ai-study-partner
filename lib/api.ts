'use client'
import axios from 'axios'

const api = axios.create({ baseURL: '' }) // same-origin — calls /api/* Next.js routes

export default api
