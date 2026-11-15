import Image from "next/image";
import Link from "next/link";
import { editorialPhotos } from "./editorial-photos";
import HomeEditorialMotion from "./HomeEditorialMotion";

const seasonalPhotos = [
  {
    id: "chunfen",
    season: "春",
    term: "春分",
    scene: "云南罗平 · 油菜花田",
    note: "春分前后，昼夜时长接近。罗平的油菜花沿着山脚田埂铺开。",
    photo: editorialPhotos.canola,
  },
  {
    id: "xiaoshu",
    season: "夏",
    term: "小暑",
    scene: "北京圆明园 · 白荷",
    note: "小暑过后，暑气渐盛，荷花是盛夏池塘里的一景。",
    photo: editorialPhotos.lotus,
  },
  {
    id: "qiufen",
    season: "秋",
    term: "秋分",
    scene: "辽宁 · 金色秋田",
    note: "秋分前后，辽宁的田野渐染金黄。沉甸甸的谷穗低垂，一直铺到远处的山脚。",
    photo: editorialPhotos.harvest,
  },
  {
    id: "daxue",
    season: "冬",
    term: "大雪",
    scene: "北京故宫 · 雪中午门",
    note: "大雪时节寒意渐深。雪落午门，白雪沿着红墙和屋檐积起。",
    photo: editorialPhotos.snow,
  },
] as const;

const galleryImageSizes = "(max-width: 700px) 68vw, (max-width: 1400px) 28vw, 400px";
const bookPageSizes = "(max-width: 640px) 46vw, (max-width: 1400px) 25vw, 360px";

function SectionHeading({ id, children }: { id: string; children: string }) {
  return (
    <header className="home-section-heading" data-home-reveal="">
      <span className="home-section-knot" aria-hidden="true" />
      <h2 id={id}>{children}</h2>
      <span className="home-section-knot" aria-hidden="true" />
    </header>
  );
}

export default function HomeEditorial() {
  return (
    <HomeEditorialMotion>
      <section className="home-term-intro" aria-labelledby="home-term-heading">
        <SectionHeading id="home-term-heading">认识二十四节气</SectionHeading>
        <div className="home-term-overview">
          <div className="home-term-summary" data-home-reveal="">
            <p>从地球上看，太阳在天空中的位置沿着一条叫作黄道的路径变化。每前进 15°，就到一个新节气。春夏秋冬各有六个，从立春排到大寒。</p>
            <p>古人用节气记下昼夜、寒暑与草木的变化，安排播种和收获。这些时间标记也融进了各地的饮食和习俗。<a className="home-term-source" href="https://www.hko.gov.hk/tc/gts/time/24solarterms.htm" target="_blank" rel="noreferrer">历法说明<span className="sr-only">（新窗口打开）</span></a></p>
          </div>
          <div className="home-term-overview-art" data-home-reveal="">
            <Image
              src="/images/home/editorial-lotus-collage.webp"
              alt="粉荷、碧叶和水波叠成的荷塘剪纸"
              width={1100}
              height={825}
              sizes="(max-width: 640px) 78vw, (max-width: 1200px) 42vw, 470px"
            />
          </div>
        </div>

        <div className="home-term-gallery">
          {seasonalPhotos.map(({ id, season, term, scene, note, photo }) => (
            <figure className="home-term-photo" data-term={id} data-home-reveal="" key={id}>
              <div className="home-term-image">
                {id === "qiufen" || id === "daxue" ? (
                  <div className="home-term-cutout">
                    {id === "daxue" && <Image className="home-term-cutout-base" src={photo.src} alt="" fill sizes={galleryImageSizes} />}
                    <Image className="home-term-cutout-subject" src={photo.src} alt={photo.caption} fill sizes={galleryImageSizes} />
                  </div>
                ) : <Image src={photo.src} alt={photo.caption} fill sizes={galleryImageSizes} />}
              </div>
              <span className="home-term-season" aria-hidden="true">{season}</span>
              <figcaption>
                <h3 className="home-term-caption">
                  <Link href={`/explore?solarTermId=${id}`} prefetch={false} aria-label={`查看${term}的地方故事`}>{term}</Link>
                </h3>
                <p className="home-term-place">{scene}</p>
                <p className="home-term-photo-note">{note}</p>

              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="home-chapter home-chapter-seasons" aria-labelledby="home-seasons-heading">
        <SectionHeading id="home-seasons-heading">四时</SectionHeading>
        <div className="home-chapter-body" data-home-reveal="">
          <figure className="home-chapter-art home-book-art">
            <div className="home-book-spread">
              <Image className="home-book-left" src="/images/home/editorial-book-lichun-left.webp" alt="立春左页，含花枝插画和北京咬春的小识" width={530} height={620} sizes={bookPageSizes} />
              <Image className="home-book-right" src="/images/home/editorial-book-lichun-right.webp" alt="立春右页，近拍枝头绽开的梅花" width={530} height={620} sizes={bookPageSizes} />
            </div>
            <figcaption><strong>立春 · 风物册书页</strong></figcaption>
          </figure>
          <div className="home-chapter-copy">
            <p>从立春翻到大寒，读节气、看风物。点「AI 再讲一点」，实时生成当前节气的补充讲解。</p>
            <Link className="home-chapter-link" href="/seasons" prefetch={false}>翻开风物册</Link>
            <p className="home-chapter-example">试试切换「讲给小朋友」，用更通俗的方式读懂节气。</p>
          </div>
        </div>
      </section>

      <section className="home-chapter home-chapter-explore" aria-labelledby="home-explore-heading">
        <SectionHeading id="home-explore-heading">知时</SectionHeading>
        <div className="home-chapter-body" data-home-reveal="">
          <div className="home-chapter-art home-atlas-art">
            <figure className="home-atlas-print">
              <div className="home-atlas-photo">
                <Image src={editorialPhotos.ritan.src} alt={editorialPhotos.ritan.caption} fill sizes="(max-width: 640px) 88vw, (max-width: 1400px) 49vw, 650px" />
              </div>
              <figcaption><strong>北京朝阳 · 日坛西天门</strong></figcaption>
            </figure>
          </div>
          <div className="home-chapter-copy">
            <h3 className="home-chapter-case">春分 · 日坛祭日</h3>
            <p>明清时，朝廷在春分这天到日坛祭日。<a className="home-term-source" href="https://yllhj.beijing.gov.cn/ztxx/lhysh/st/202304/t20230411_3003938.shtml" target="_blank" rel="noreferrer">史料出处<span className="sr-only">（新窗口打开）</span></a></p>
            <p>请 AI 比较各地习俗，查看案例出处，并在地图上定位。</p>
            <Link className="home-chapter-link" href="/explore?solarTermId=chunfen&provinceCode=110000" prefetch={false}>问节气，查出处</Link>
            <p className="home-chapter-example">试试问「江苏和浙江的冬至习俗有什么不同？」</p>
            <Link className="home-term-source home-visit-link" href="/visit" prefetch={false}>节气探访 · 选省份和节气，查地方习俗</Link>
          </div>
        </div>
      </section>

      <section className="home-chapter home-chapter-studio" aria-labelledby="home-studio-heading">
        <SectionHeading id="home-studio-heading">造物</SectionHeading>
        <div className="home-chapter-body" data-home-reveal="">
          <div className="home-chapter-art home-studio-art">
            <Image className="home-studio-poster" src="/images/home/editorial-spring-poster.webp" alt="谷雨画报《雨入春山》，有远山、小桥和燕子" width={480} height={640} sizes="(max-width: 640px) 34vw, (max-width: 1400px) 19vw, 245px" />
            <Image className="home-studio-bookmark" src="/images/home/editorial-osmanthus-bookmark.webp" alt="秋分书签，绘有一枝桂花" width={180} height={540} sizes="(max-width: 640px) 13vw, (max-width: 1400px) 8vw, 95px" />
            <Image className="home-studio-card" src="/images/home/editorial-lotus-card.webp" alt="小暑节气卡《荷风》，画着荷花和水纹" width={480} height={600} sizes="(max-width: 640px) 34vw, (max-width: 1400px) 20vw, 250px" />
          </div>
          <div className="home-chapter-copy">
            <p>挑一个节气，让 AI 生成标题和短句。选用后填入作品，再配上喜欢的底色和贴纸。</p>
            <Link className="home-chapter-link" href="/studio" prefetch={false}>做一张节气卡</Link>
            <p className="home-chapter-example">从「知时」或「节气探访」带入一则案例，做成节气卡并保存为图片。</p>
          </div>
        </div>
      </section>
      <div className="home-editorial-notes"><Link href="/about#home-photo-sources" prefetch={false}>影像鸣谢</Link></div>
    </HomeEditorialMotion>
  );
}
