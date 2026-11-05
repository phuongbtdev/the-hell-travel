type Point=[number,number,number];
export type ExperienceProfile={
  duration:number;handoff:Point;camera:Point;focusOffset:Point;fixedFocus?:Point;
  positioningArc:number;reactionEvery:number;vowel:'aa'|'oh'|'uu';
  escortWait?:Point;
  moments:[string,string,string];
};
/** Choreography and framing are authored per station, independent of the escort. */
export const EXPERIENCE_PROFILES:ExperienceProfile[]=[
 {duration:12,handoff:[-3,0,-1.25],camera:[-4.5,3,-1.3],focusOffset:[-.4,.95,0],positioningArc:.45,reactionEvery:2,vowel:'aa',moments:['Quỷ sai giữ kẹp · chuẩn bị kéo','Rút lưỡi · càng cãi càng dài','Thu kẹp · xin nói ít lại một chút']},
 {duration:12,handoff:[3,0,-1.25],camera:[3.8,2.9,-1],focusOffset:[0,1.1,0],positioningArc:.45,reactionEvery:2,vowel:'oh',moments:['Giữ hồn · quỷ sai cắt tách hai tay','Tách tiếp từng phần · các mảnh hồn lơ lửng','Thu kéo · gom các mảnh hồn ghép lại']},
 {duration:14,handoff:[-6.1,0,-5],camera:[4.8,4.2,-.4],focusOffset:[0,1.25,0],positioningArc:1.25,reactionEvery:2.7,vowel:'uu',moments:['Treo lên cành sắt · giữ dây cho chắc','Đung đưa trên gai · quỷ sai leo tới gỡ','Gỡ dây · áo quan sai cũng mắc luôn']},
 {duration:14,handoff:[0,0,-1.25],camera:[3.4,3.1,-.4],focusOffset:[.3,1.3,-.1],positioningArc:.3,reactionEvery:2.8,vowel:'oh',moments:['Giữ hồn trên ghế · bóc lớp mặt hiền đầu tiên','Lộ thêm mặt giả · quỷ sai ném đầy cả xe','Vừa bóc xong lại mọc mặt mới · gọi thêm xe!']},
 {duration:14,handoff:[0,0,-1.25],camera:[-4.6,3.4,.2],focusOffset:[0,.85,0],positioningArc:.4,reactionEvery:2.5,vowel:'aa',moments:['Cửa lồng mở · mời bước vào','Đóng lồng · hơi nóng cuộn lên','Mở cửa · quỷ sai lại quạt khói vào mình']},
 {duration:12,handoff:[3,0,-1.25],camera:[4.8,3.2,-.4],focusOffset:[0,1,0],positioningArc:.4,reactionEvery:2.3,vowel:'aa',moments:['Áp sát cột đồng · chuẩn bị ôm','Giữ hai tay · cột nóng lên từng nhịp','Nới tay · quan sai cũng không dám chạm']},
 {duration:16,handoff:[-6,0,-3.5],camera:[6,4.6,1.2],focusOffset:[0,.95,-.5],positioningArc:.5,reactionEvery:2.8,vowel:'oh',moments:['Bắt đầu leo · quỷ sai đứng dưới cổ vũ','Trượt xuống núi đao · vịn tay lại','Leo thêm một lượt · vẫn câu sắp tới rồi']},
 {duration:12,handoff:[0,0,-1.25],camera:[3.8,2.8,.3],focusOffset:[0,.95,0],positioningArc:.35,reactionEvery:2.8,vowel:'uu',moments:['Đứng trên băng · gió lạnh nổi lên','Run cầm cập · hơi thở hóa sương','Được thả · quỷ sai vẫn còn run']},
 {duration:14,handoff:[6,0,-4],camera:[4.8,4.8,-.2],focusOffset:[0,1,0],positioningArc:1.8,reactionEvery:2,vowel:'aa',moments:['Móc dây nâng · đưa lên miệng vạc','Nhúng xuống rồi kéo lên · bọt dầu nổ','Nâng khỏi vạc · cả đội cùng giật mình']},
 {duration:16,handoff:[-6,0,0],camera:[7.2,5.5,1.8],focusOffset:[0,1,0],fixedFocus:[0,1.1,-6],positioningArc:.4,reactionEvery:2.5,vowel:'oh',moments:['Vào sân trâu · cổng đã mở','Chạy vòng sân · trâu đổi hướng đuổi','Quỷ sai chạy trước · khách cố theo sau']},
 {duration:12,handoff:[-6,0,-5],camera:[-5.2,4.2,1.2],focusOffset:[0,1,.3],fixedFocus:[0,2.35,-5.8],positioningArc:.7,reactionEvery:2,vowel:'aa',moments:['Giữ hồn trên bệ · kéo đá lên cao rồi thả','RẦM! Đầu hồn vỡ tung · quỷ sai né bụi','Gom từng mảnh đầu · quỷ sai hỏi bảo hành đá']},
 {duration:12,handoff:[6,0,-5],camera:[3.5,4,-.2],focusOffset:[0,1.1,0],positioningArc:1,reactionEvery:2,vowel:'oh',moments:['Vào cối · chày được nâng lên','Chày giáng theo nhịp · người chịu phạt nhún xuống','Dừng chày · nhớ đếm một hai ba']},
 {duration:14,handoff:[-6,0,-3.5],camera:[5.2,3.2,1],focusOffset:[0,.75,0],positioningArc:.55,reactionEvery:2.8,vowel:'uu',moments:['Đưa xuống ao · giữ lấy vòng phao','Chìm nổi theo mặt nước · vẫy tay gọi quỷ sai','Kéo lên bờ · chiếc dép vẫn còn trôi']},
 {duration:16,handoff:[0,0,-1.25],camera:[4.8,3.8,1.4],focusOffset:[0,1.3,0],fixedFocus:[0,2.5,-6],positioningArc:.4,reactionEvery:2.5,vowel:'oh',moments:['Quay tời · cổ kéo dài sát xà, thân giãy phía dưới','Tuột thân! Đầu treo ngơ ngác rồi bật xuống như lò xo','Hai quỷ hứng hụt · ráp đầu lại, kiểm tra đúng chiều']},
 {duration:12,handoff:[6,0,-5],camera:[5.5,3.4,-.2],focusOffset:[0,.8,0],fixedFocus:[0,1.9,-6],positioningArc:.8,reactionEvery:2.2,vowel:'aa',moments:['Giữ bốn đầu dây · chuẩn bị kéo','Kéo lệch nhịp · người chịu phạt xoay vòng','Nới dây · cả bốn ông cùng ra lệnh']},
 {duration:14,handoff:[-6,0,-3],camera:[5.2,4.3,1],focusOffset:[0,1,-.7],positioningArc:.5,reactionEvery:2.3,vowel:'aa',moments:['Bước lên đá · dung nham bắt đầu trào','Nhảy qua khe nóng · quan sai chỉ đường vòng','Về bờ · tấm biển bảo trì vẫn ở đó']},
 {duration:12,handoff:[6,0,-3.5],camera:[4.2,4,.6],focusOffset:[0,1,0],positioningArc:1.1,reactionEvery:2.1,vowel:'uu',moments:['Đưa vào miệng cối · nâng tay cho khỏi vướng','Cối quay · người chịu phạt nhún theo vòng đá','Dừng cối · quỷ sai còn chạy theo tay quay']},
 {duration:12,handoff:[0,0,-1.25],camera:[4.6,3.7,-.2],focusOffset:[0,.85,0],positioningArc:.75,reactionEvery:2.2,vowel:'aa',moments:['Đặt lên bàn · hai đầu cưa vào vị trí','Kéo cưa đối nhịp · giữ người cho chắc','Thu cưa · thống nhất nhịp xong rồi đấy']},
];
// Keep the escort out of the station camera while the executioners take over.
for(const [index,profile] of EXPERIENCE_PROFILES.entries()){
  if(index===17)continue;
  const side=profile.handoff[0]>3?1:profile.handoff[0]<-3?-1:profile.camera[0]>0?-1:1;
  profile.escortWait=[side*6.6,0,profile.handoff[2]<-2?-9.5:-2];
}
