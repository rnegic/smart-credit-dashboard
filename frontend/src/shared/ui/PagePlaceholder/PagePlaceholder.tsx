import { Text } from '@alfalab/core-components/text'
import { Typography } from '@alfalab/core-components/typography'
import styles from './PagePlaceholder.module.scss'

export interface PagePlaceholderProps {
  title: string
  description: string
}

export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <main className={styles.root}>
      <Typography.TitleResponsive tag="h1" view="medium" font="system">
        {title}
      </Typography.TitleResponsive>
      <Text tag="p" view="paragraph-primary-medium" className={styles.description}>
        {description}
      </Text>
    </main>
  )
}
