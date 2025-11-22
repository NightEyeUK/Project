import { NavLink } from "react-router";
import "./home.css";
import background from "../../../imgs/background.jpeg";

export default function Home() {
    return (
        <>
            <div className="home">
                <div className="message">
                    <h1>Lost and Found </h1>
                    <p>• Helps you report and recover lost belongings easily.</p>
                    <p>• If you’ve lost something, submit a report so our staff can assist you.</p>
                    <p>• If you’ve found an item, please hand it to the Lost and Found Centre so we can post it here for claiming.</p>
                    <NavLink id="reportLost" to="/submit-lost-item">Report a Lost Item</NavLink>
                </div>
                <div className="note">
                    <p>Statistics show 85% of lost property (phones, bags, pets, luggage, etc.) is in honest hands. Let Lostings help you find the property/item(s) you have lost. <span>Be smart and submit your lost property with our lost and found department toady!</span></p>
                </div>
               {/*  <h1 id="tile">Developers</h1>
                <div className="dev">
                    
                    <p>Senin, Ben David</p>
                    <p>Balde, Railey</p>
                    <p>de Armas, Archie</p>
                    <p>Javier, Jam Malec</p>
                    <p>Mallari, Mark Rafael</p>
                </div> */}
            </div>
        </>
    )
}