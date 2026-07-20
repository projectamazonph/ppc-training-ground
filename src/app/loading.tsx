import styles from './loading.module.css';

export default function Loading() {
  return (
    <main id="main-content" className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.heroText}>
          <div className={`${styles.skeleton} ${styles.eyebrow}`} />
          <div className={`${styles.skeleton} ${styles.title}`} />
          <div className={`${styles.skeleton} ${styles.subtitle}`} />
          <div className={`${styles.skeleton} ${styles.subtitleShort}`} />
          <div className={styles.actions}>
            <div className={`${styles.skeleton} ${styles.btn}`} />
            <div className={`${styles.skeleton} ${styles.btnGhost}`} />
          </div>
        </div>
        <div className={`${styles.skeleton} ${styles.heroStat}`} />
      </div>
    </main>
  );
}
