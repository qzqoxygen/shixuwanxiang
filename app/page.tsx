import HomeEditorial from "./home/HomeEditorial";
import SpringScene from "./home/SpringScene";
import "./home/spring-home.css";
import "./home/home-editorial.css";

export default function Home() {
  return (
    <div className="spring-home">
      <section className="spring-window" aria-labelledby="spring-title">
        <div className="spring-scene">
          <SpringScene />
        </div>
      </section>

      <HomeEditorial />
    </div>
  );
}
