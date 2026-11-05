type Point=[number,number,number];
export type ExperienceProfile={
  duration:number;handoff:Point;camera:Point;focusOffset:Point;fixedFocus?:Point;
  positioningArc:number;reactionEvery:number;vowel:'aa'|'oh'|'uu';
  escortWait?:Point;
  moments:[string,string,string];
};
/** Choreography and framing are authored per station, independent of the escort. */
export const EXPERIENCE_PROFILES:ExperienceProfile[]=[
 {duration:12,handoff:[-3,0,-1.25],camera:[-4.5,3,-1.3],focusOffset:[-.4,.95,0],positioningArc:.45,reactionEvery:2,vowel:'aa',moments:['Kẹp trúng lưỡi · kéo dài, máu rơi theo nhịp','Lưỡi dài quá tay · quỷ sai phải lùi theo','Lưỡi bật ngược · quỷ sai suýt ngã ngửa']},
 {duration:12,handoff:[3,0,-1.25],camera:[3.8,2.9,-1],focusOffset:[0,1.1,0],positioningArc:.45,reactionEvery:2,vowel:'oh',moments:['Cắt hai tay · vết cắt đỏ, các mảnh hồn rời ra','Cắt tiếp thân và đầu · máu bắn theo mũi kéo','Gom lại đủ bộ · kiểm tra xem có thiếu tay không']},
 {duration:14,handoff:[-6.1,0,-5],camera:[4.8,4.2,-.4],focusOffset:[0,1.25,0],positioningArc:1.25,reactionEvery:2.7,vowel:'uu',moments:['Cành gai siết tay · hồn giật theo dây, máu nhỏ xuống','Quỷ sai leo gỡ · áo mình lại mắc trên cành','Người lẫn quỷ cùng treo · chưa biết gỡ ai trước']},
 {duration:14,handoff:[0,0,-1.25],camera:[3.4,3.1,-.4],focusOffset:[.3,1.3,-.1],positioningArc:.3,reactionEvery:2.8,vowel:'oh',moments:['Bóc lớp mặt hiền · sợi mô đỏ kéo giãn theo','Mặt bên dưới đỏ rực · máu rơi, xe chất đầy mặt','Vừa bóc xong lại mọc mặt mới · gọi thêm xe!']},
 {duration:14,handoff:[0,0,-1.25],camera:[-4.6,3.4,.2],focusOffset:[0,.85,0],positioningArc:.4,reactionEvery:2.5,vowel:'aa',moments:['Đóng lồng · da đỏ lên, thân bắt đầu phồng','Quá áp! Hồn xì hơi hai tai · quạt quỷ sai bay lên','Xả hơi · quỷ vừa quạt vừa tự hứng khói']},
 {duration:12,handoff:[3,0,-1.25],camera:[4.8,3.2,-.4],focusOffset:[0,1,0],positioningArc:.4,reactionEvery:2.3,vowel:'aa',moments:['Áp sát cột đồng · chuẩn bị ôm','Giữ hai tay · cột nóng lên từng nhịp','Nới tay · quan sai cũng không dám chạm']},
 {duration:16,handoff:[-6,0,-3.5],camera:[6,4.6,1.2],focusOffset:[0,.95,-.5],positioningArc:.5,reactionEvery:2.8,vowel:'oh',moments:['Bám núi đao · trượt chân, máu bắn khi quệt lưỡi sắc','Leo lại rồi trượt tiếp · quỷ sai cũng giẫm trúng đao','Vẫn còn phải leo · quan sai đứng dưới nhảy một chân']},
 {duration:12,handoff:[0,0,-1.25],camera:[3.8,2.8,.3],focusOffset:[0,.95,0],positioningArc:.35,reactionEvery:2.8,vowel:'uu',moments:['Đứng trên băng · gió lạnh nổi lên','Run cầm cập · hơi thở hóa sương','Được thả · quỷ sai vẫn còn run']},
 {duration:14,handoff:[6,0,-4],camera:[4.8,4.8,-.2],focusOffset:[0,1,0],positioningArc:1.8,reactionEvery:2,vowel:'aa',moments:['Móc dây nâng · đưa lên miệng vạc','Nhúng xuống rồi kéo lên · bọt dầu nổ','Nâng khỏi vạc · cả đội cùng giật mình']},
 {duration:16,handoff:[-6,0,0],camera:[7.2,5.5,1.8],focusOffset:[0,1,0],fixedFocus:[0,1.1,-6],positioningArc:.4,reactionEvery:2.5,vowel:'oh',moments:['Vào sân · trâu ghìm đầu lấy đà','Trâu húc văng hồn · lộn ngược cắm đầu xuống sân','Trâu quay sang đuổi quỷ · khách tự nhổ đầu lên']},
 {duration:12,handoff:[-6,0,-5],camera:[-5.2,4.2,1.2],focusOffset:[0,1,.3],fixedFocus:[0,2.35,-5.8],positioningArc:.7,reactionEvery:2,vowel:'aa',moments:['Giữ hồn trên bệ · kéo đá lên cao rồi thả','RẦM! Đầu hồn vỡ tung · quỷ sai né bụi','Gom từng mảnh đầu · quỷ sai hỏi bảo hành đá']},
 {duration:12,handoff:[6,0,-5],camera:[3.5,4,-.2],focusOffset:[0,1.1,0],positioningArc:1,reactionEvery:2,vowel:'oh',moments:['Chày nâng cao rồi nện · thân bẹp theo cú đập','Máu phun qua miệng cối · đầu nảy lên như lò xo','Đếm nhịp giúp quỷ · nhớ gom đủ đầu và thân']},
 {duration:14,handoff:[-6,0,-3.5],camera:[5.2,3.2,1],focusOffset:[0,.75,0],positioningArc:.55,reactionEvery:2.8,vowel:'uu',moments:['Đưa xuống ao · giữ lấy vòng phao','Chìm nổi theo mặt nước · vẫy tay gọi quỷ sai','Kéo lên bờ · chiếc dép vẫn còn trôi']},
 {duration:16,handoff:[0,0,-1.25],camera:[4.8,3.8,1.4],focusOffset:[0,1.3,0],fixedFocus:[0,2.5,-6],positioningArc:.4,reactionEvery:2.5,vowel:'oh',moments:['Quay tời · cổ kéo dài sát xà, thân giãy phía dưới','Tuột thân! Đầu treo ngơ ngác rồi bật xuống như lò xo','Hai quỷ hứng hụt · ráp đầu lại, kiểm tra đúng chiều']},
 {duration:12,handoff:[6,0,-5],camera:[5.5,3.4,-.2],focusOffset:[0,.8,0],fixedFocus:[0,1.9,-6],positioningArc:.8,reactionEvery:2.2,vowel:'aa',moments:['Siết bốn dây · thân kéo căng, các mảnh bắt đầu rời','Tay, chân, đầu tách ra · máu văng, dây vẫn giữ từng phần','Nới dây, ráp lại · bốn ông vẫn chưa thống nhất nhịp']},
 {duration:14,handoff:[-6,0,-3],camera:[5.2,4.3,1],focusOffset:[0,1,-.7],positioningArc:.5,reactionEvery:2.3,vowel:'aa',moments:['Bước lên đá · dung nham bắt đầu trào','Nhảy qua khe nóng · quan sai chỉ đường vòng','Về bờ · tấm biển bảo trì vẫn ở đó']},
 {duration:12,handoff:[6,0,-3.5],camera:[4.2,4,.6],focusOffset:[0,1,0],positioningArc:1.1,reactionEvery:2.1,vowel:'uu',moments:['Đưa vào cối · thân bị ép, đầu vẫn cố ló lên','Máu chảy qua khe · dải hồn cuộn ra như mì','Cối hút dải hồn trở lại · quỷ mắc luôn vào tay quay']},
 {duration:12,handoff:[0,0,-1.25],camera:[4.6,3.7,-.2],focusOffset:[0,.85,0],positioningArc:.75,reactionEvery:2.2,vowel:'aa',moments:['Đặt lên bàn · hai đầu cưa vào vị trí','Kéo cưa đối nhịp · giữ người cho chắc','Thu cưa · thống nhất nhịp xong rồi đấy']},
];
// Keep the escort out of the station camera while the executioners take over.
for(const [index,profile] of EXPERIENCE_PROFILES.entries()){
  if(index===17)continue;
  const side=profile.handoff[0]>3?1:profile.handoff[0]<-3?-1:profile.camera[0]>0?-1:1;
  profile.escortWait=[side*6.6,0,profile.handoff[2]<-2?-9.5:-2];
}
