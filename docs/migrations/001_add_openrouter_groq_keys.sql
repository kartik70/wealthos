-- Migration 001: add OpenRouter and Groq key columns to user_api_keys
-- Run this once in the Supabase SQL Editor.

ALTER TABLE public.user_api_keys
  ADD COLUMN IF NOT EXISTS openrouter_key text,
  ADD COLUMN IF NOT EXISTS groq_key text;
