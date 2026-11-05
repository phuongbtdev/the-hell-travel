export type Speaker='guide'|'demon'|'victim'|'judge'|'clerk';
export type DialogueLine={speaker:Speaker;text:string};
export const SPEAKER_NAMES:Record<Speaker,string>={guide:'Tiểu Sai',demon:'Quỷ sai',victim:'Hồn chịu phạt',judge:'Diêm Vương',clerk:'Thư lại'};
const exchanges:[string,string][]=[
 ['Kéo thêm chút nữa… Ấy, đừng buông kẹp!','Lưỡi tôi dài rồi, sao ông còn ăn vả ngược vậy?!'],
 ['Giữ phần hồn bên trái. Cắt từng nhịp, nhớ gom đủ các mảnh!','Nhớ ráp đủ giúp tôi. Đừng gửi thiếu mảnh, mai tôi còn đi tham quan!'],
 ['Để ta leo lên gỡ ngươi xuống.','Áo của ông cũng mắc vào cành rồi kìa!'],
 ['Lớp mặt hiền, lớp mặt oan, lớp mặt dữ… Xe đầy rồi! Gọi thêm xe!','Tôi chỉ có hai mặt thôi mà! Mấy cái còn lại là phiên bản cập nhật!'],
 ['Áp suất đỏ rồi! Ai khóa van xả thế này?!','Tôi đang xì hơi bằng tai! Bắt cái quạt lại giùm!'],
 ['Ôm sát cột đồng. Để ta làm mẫu.','Ông vừa chạm thử đã nhảy xa hơn tôi rồi!'],
 ['Bám chắc! Ta tới cứu… Khoan, dao dính vào giày ta rồi!','Tôi trượt xuống bốc khói rồi, ông còn nhảy lò cò phía dưới!'],
 ['Đứng yên. Đừng có run nữa.','Chính ông còn đang run mạnh hơn tôi đó!'],
 ['Một, hai, ba. Bắt đầu nhúng!','Bụp! Có mỗi bọt dầu mà cả đội cũng giật mình!'],
 ['Trâu kia! Đuổi đúng người đi!','Tôi bay tới đây rồi! Ai kéo đầu tôi khỏi sàn giùm!'],
 ['Kéo đá lên! Thả! …Đầu cứng thế này, đá có được bảo hành không?','Gom đủ giúp tôi! Có mảnh đang trừng mắt nhìn ông kìa!'],
 ['Giữ đúng nhịp chày nào! Ấy, cái đầu bật ra rồi!','Nhẹ tay! Đầu tôi đâu phải nút chai!'],
 ['Ta đã thấy vật thể dưới ao rồi.','Ông khều nãy giờ chỉ để vớt chiếc dép của tôi à?'],
 ['Kéo vừa thôi! Thân tuột rồi! Cầm vợt sang đây, đỡ cái đầu!','Tôi bảo muốn vươn lên, đâu bảo kéo riêng cái đầu lên trước!'],
 ['Bốn bên cùng kéo theo hiệu lệnh!','Tay bên kia! Chân bên này! Đừng ráp ngược, tôi còn phải đi tiếp!'],
 ['Đường đang bảo trì. Xin đi vòng.','Đi vòng bên nào cũng là dung nham hết vậy?'],
 ['Cối chạy rồi! Sao khe đá lại ra mì thế này?!','Tôi đăng ký tham quan, đâu đăng ký thành bún!'],
 ['Kéo! Đẩy! Không, ông kéo thì tôi phải đẩy!','Hai ông thống nhất nhịp trước được không? Tôi nằm chờ đây.'],
];
export function zoneDialogue(id:string):DialogueLine[]{
 if(id==='registry')return [{speaker:'clerk',text:'Hồn mới xuống, bấm nút Ghi danh trên đầu tôi rồi điền tên vong hồn nhé. Thư lại cần biết tên để còn gọi, chứ gọi ê vong kia thì cả hàng quay lại.'},{speaker:'guide',text:'Tôi là Tiểu Sai. Bấm hoặc chạm mặt đất để đi, bấm nút trên NPC để tương tác. Nhận thẻ xong, mời ngài ghé Chính Điện hoặc chọn tầng trên bản đồ.'}];
 if(id==='hall')return [{speaker:'judge',text:'Chào các hồn mới đến. Đã có thẻ thì cứ tự nhiên tham quan mười tám tầng. Khi gọi số, nhớ quay lại.'},{speaker:'clerk',text:'Thư lại đang kiểm tra sổ. Xin đừng đọc hồ sơ của nhau.'}];
 const pair=exchanges[Number(id.replace('floor-',''))-1];return pair?[{speaker:'demon',text:pair[0]},{speaker:'victim',text:pair[1]}]:[];
}

const stories=[
 ['lời nói dối, vu khống và gieo chuyện ác','Cái miệng đi trước, cái đầu còn đang tìm dép. Xuống đây lời nói không bay đi mất; thư lại ghi đủ, cả đoạn nói nhỏ cũng nghe rõ.'],
 ['những lời chia rẽ và phá hoại tình nghĩa','Trên dương gian cắt câu chuyện cho vừa ý mình. Xuống đây quỷ sai dùng kéo cắt rời tay, đuôi rồi tới đầu hồn. Các mảnh vẫn giãy, máu rơi xuống bệ, chờ ghép đủ bộ. Quỷ sai kiểm hàng rất kỹ; hồn chỉ xin đừng ráp tay trái sang bên phải.'],
 ['sự lừa lọc khiến người khác mắc kẹt trong rắc rối','Gieo gai cho người rồi bảo mình chỉ góp ý. Đến đây tay hồn bị gai sắt giữ lại, giãy một nhịp là máu lại nhỏ. Quỷ sai trèo lên cứu, áo mình lại mắc trước. Hai bên treo đung đưa, nhìn nhau chờ người thứ ba biết gỡ.'],
 ['thói hai mặt, giả nhân giả nghĩa và lợi dụng lòng tin','Trước mặt thì thương bạn, sau lưng thì kể bạn. Xuống đây quỷ sai bóc từng lớp mặt nạ: mặt hiền, mặt oan, rồi tới mặt dữ. Mặt nạ rơi vào xe vẫn cười, còn chủ thì hết cười nổi. Bóc tới đâu sợi thịt đỏ kéo theo tới đó, mặt bên dưới đỏ rát. Bóc gần xong lại mọc thêm mặt mới. Quỷ sai xin tăng ca, xe chở mặt nạ xin tăng tải.'],
 ['sự phỉnh gạt và những lời vu cáo làm khổ người khác','Khi kể chuyện thì thêm mắm thêm muối. Đến đây chỉ xin bớt một chút hơi. Hơi nóng làm hồn đỏ mặt rồi phồng như quả bóng. Đến vạch đỏ, hai tai phụt hơi, thân xẹp xuống còn chiếc quạt của quỷ bay lên trời. Hấp một khách mà phải thu hồi cả quạt.'],
 ['lòng tham và những việc cố ý làm hại người khác','Trên kia nóng tính bảo đó là cá tính. Ở đây có cột đồng còn nóng hơn. Nhớ đứng xa quan sai đang định làm mẫu; ông ấy cũng chưa thử bao giờ.'],
 ['sự hung bạo và việc gây tổn hại đến sinh mạng','Đường núi đao nhắc rằng làm đau người khác thì dễ, bước lại cho tử tế mới khó. Leo được nửa đường thì hồn trượt xuống qua lưỡi đao, để lại vệt máu. Quỷ sai chạy tới cứu lại dính dao vào giày, nhảy lò cò còn nhiệt tình hơn người bị phạt.'],
 ['sự bạc nghĩa và lạnh lòng trước nỗi khổ của người khác','Ngày trước ai nhờ cũng lạnh như băng. Bây giờ băng trả lời rồi đây. Quỷ sai mặc ba lớp áo, vẫn run và vẫn nhất quyết bảo mình ổn.'],
 ['sự gian tham, chiếm đoạt và kiếm lợi bằng nỗi khổ của người khác','Tính toán lời lãi từng chút, đến vạc dầu lại xin giảm nhiệt một chút. Có mỗi bọt dầu nổ mà cả đội quan sai giật mình. Ai cũng có lần đầu.'],
 ['sự tàn nhẫn với loài vật','Ở đây trâu được quyền lên tiếng, chủ yếu bằng tiếng móng chân. Trâu lấy đà húc văng hồn qua sân; đầu cắm xuống bệ, đuôi chổng lên trời. Quan sai nhận nhiệm vụ chỉ đường, trâu lại quay sang đuổi đúng ông ấy. Giờ người chạy nhanh nhất đoàn chính là hướng dẫn viên.'],
 ['việc dùng sức mạnh để bức hiếp kẻ yếu','Trước kia đè người bằng quyền thế. Tới đây tảng đá chẳng hỏi chức danh: quỷ sai kéo lên cao rồi thả rầm xuống. Đầu hồn vỡ thành từng mảnh linh thể, mắt còn đang lườm người thi hành. Gom đủ các mảnh thì đầu tự ghép lại. Quỷ sai thở phào, quay sang xin phiếu bảo hành cho tảng đá.'],
 ['thói tham lấy, gian dối và coi nhẹ công sức của người khác','Chày nhấc cao rồi nện xuống, hồn bẹp ngang, máu bắn trên vành cối. Chày vừa nhấc thì đầu nảy lên như nút chai, thân lại phồng về chỗ cũ. Quỷ sai gọi đó là nhịp làm việc; hồn gọi đó là hết hồn thêm sáu lần.'],
 ['những hậu quả để lại khi mình gây đau khổ cho người khác','Ao đỏ là hình ảnh sân khấu của những điều day dứt. Nhìn xa tưởng quỷ sai đang thi triển phép lớn. Đến gần mới thấy ông ấy khều chiếc dép mãi chưa tới.'],
 ['thói ngạo mạn, ham hơn người và chà đạp người khác để leo cao','Ngày trước lúc nào cũng muốn đứng trên đầu người khác. Xuống đây quỷ sai quay tời cho cổ dài lên tận xà nhà, thân giãy phía dưới như đang mất sóng. Giãy quá thì tuột cả thân, để mỗi cái đầu treo ngơ ngác. Quỷ vừa thả chốt, đầu bật xuống như lò xo. Một ông hứng đầu, một ông giữ thân; ráp xong còn hỏi đã đúng chiều chưa.'],
 ['sự phản trắc và những việc xâm phạm tình nghĩa, nơi an nghỉ của người khác','Bốn quỷ kéo căng dây, tay chân và đầu hồn bung ra từng hướng, để lại các mấu đỏ. Nhưng bốn người đếm bốn nhịp khác nhau, thế là các mảnh quay như chong chóng. Hết lượt tự ghép lại, hồn kiểm tra đủ bộ rồi mới dám đi.'],
 ['việc lợi dụng quyền thế, tham lợi và gây họa cho người khác','Ngày trước thích đi đường tắt. Đến núi lửa thì đường tắt cũng đang bảo trì. Quan sai dựng biển rất đúng lúc, chỉ chưa tìm được đường vòng.'],
 ['lòng tham và sự tàn nhẫn lặp đi lặp lại','Cối xay nhắc rằng một việc xấu làm mãi cũng thành vòng luẩn quẩn. Cối ép bẹp thân, cái đầu cứ bật lên qua khe đá; máu và những sợi linh hồn đỏ xanh tuôn ra như mì. Hồn chưa kịp phản đối thì quan sai đã bị tay quay kéo chạy vòng quanh. Cả hai cùng xin dừng máy, chẳng ai chịu buông tay.'],
 ['sự gian trá và phản bội khiến người khác phải gánh hậu quả','Chuyện dân gian dùng cưa xẻ để nhắc về những việc làm chia cắt tình nghĩa. Trong màn diễn này, người chịu phạt nằm chờ hai quan sai thống nhất nhịp. Tác phong rất nghiêm, phối hợp hơi hên xui.'],
];
export function floorNarration(index:number,name:string):DialogueLine[]{
 const s=stories[index];if(!s)return [];
 return [{speaker:'guide',text:`Ngài đang ở tầng ${index+1}, ${name}. Trong bản chuyển thể dân gian của chuyến tham quan này, hình phạt gợi nhắc về ${s[0]}. ${s[1]}`},...zoneDialogue(`floor-${index+1}`)];
}
export function judgeVerdict(ticket:number,visited:number):DialogueLine[]{
 const charges=[
  'Sổ nghiệp ghi: nghe chuyện mới được nửa câu, đã vội kể lại thành ba phiên bản.',
  'Sổ nghiệp ghi: miệng bảo không thích drama, tay đã kéo ghế ngồi hàng đầu.',
  'Sổ nghiệp ghi: hứa thay đổi rất chân thành, nhưng lần nào cũng hẹn bắt đầu từ ngày mai.',
  'Sổ nghiệp ghi: khuyên người ta sống chậm, riêng chuyện phán xét thì nhanh hơn quỷ sai đóng dấu.',
 ];
 if(visited>=18)return [{speaker:'judge',text:`Hồn số ${ticket}, đã đi đủ mười tám tầng. Khá lắm. Trẫm phán: nhớ chuyện đã nghe, bớt gieo chuyện cho người khác. Thư lại đâu, đóng dấu hoàn thành. Đóng vào thẻ, đừng đóng vào mặt khách!`}];
 return [{speaker:'judge',text:`Hồn số ${ticket}, tiến lên nghe phán. ${charges[Math.floor(Math.random()*charges.length)]} Tội chưa chắc nặng, nhưng tự tin thì đầy sổ. Trẫm phán ngươi đi đủ mười tám tầng, nghe kể cho rõ. Hiện mới đi ${visited} tầng, còn ${18-visited} tầng nữa. Đừng lướt qua như lướt điều khoản sử dụng!`},{speaker:'clerk',text:'Đã ghi phán quyết. Ngài vẫn được tự do chọn tầng và đi lại. Đi đủ rồi quay lại để Diêm Vương đóng dấu hoàn thành nhé.'}];
}
