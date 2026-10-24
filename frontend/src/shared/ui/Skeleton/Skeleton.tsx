import type { CSSProperties } from 'react'
import styles from './Skeleton.module.scss'

export interface SkeletonProps {
  width?: CSSProperties['width']
  height?: CSSProperties['height']
  radius?: CSSProperties['borderRadius']
  className?: string
}

export function Skeleton({
  width = '100%',
  height = '1rem',
  radius,
  className,
}: SkeletonProps) {
  return (
    <span
      className={`${styles.skeleton}${className ? ` ${className}` : ''}`}
      style={{ inlineSize: width, blockSize: height, borderRadius: radius }}
      aria-hidden="true"
    />
  )
}
