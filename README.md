# 18 Tầng Địa Ngục — web 3D

Prototype web nhiều người chơi dùng Three.js và Colyseus. Mỹ thuật theo các concept sheet trong `public/assets/concept`. Bộ 15 nhân vật gồm các hồn ma, lữ hành nam/nữ, Tiểu Sai, Diêm Vương, thư lại, ba quỷ sai, người chịu phạt, chó ngao và trâu quỷ. Mỗi model có rig và 18 animation clip, dựng bằng script theo ảnh tham chiếu.

Mở `/character-review.html` để chọn một trong 15 nhân vật, xoay model, đổi chuyển động và tải GLB. Không cần ứng dụng dựng hình bên ngoài.

## Hành trình

1. Vào game, bấm/chạm mặt đất để đi tới bàn tiếp dẫn bên trái. Bấm **Ghi danh · nhập tên** trên đầu Thư lại, nhập tên vong hồn rồi nhận thẻ. Tên được lưu trên thiết bị, hiện trên thẻ và đồng bộ trên đầu nhân vật cho người cùng phòng.
2. Đi thẳng đến điện phía sau cổng, hoặc bấm **Chính điện** phía trên.
3. Tiếp cận Diêm Vương để đối thoại, hoặc chọn một trong 18 cổng ở hai bên điện.
4. Mở **Bản đồ 18 tầng** để đi tự do. Mỗi tầng có cảnh vật, vòng chuyển động hài, âm thanh nền và cổng quay lại/đi tiếp.
5. Bấm **Đọc chuyện tội và phạt** để xem lời dẫn và đối đáp. Ở Chính Điện, bấm **Xem Diêm Vương phán**; lời phán thay đổi khi đã đi đủ 18 tầng. Phụ đề chữ lớn nằm dưới màn hình, tự chia đoạn ngắn; dùng **Tiếp tục**, phím cách, nút quay lại hoặc đóng để đọc theo nhịp riêng.
6. Mỗi tầng có video diễn cận cảnh dùng cùng mô hình và hoạt cảnh 3D. Có thể phóng to video bằng nút mũi tên.
7. Nút vàng **Trải nghiệm hình phạt**, phía trên nút đọc chuyện, gọi một quỷ sai tới bắt và áp giải hồn ma của bạn vào vị trí thi hành. Nhân vật người chơi thay cho người chịu phạt trong màn diễn 12–16 giây tùy tầng, sau đó được đưa trở ra. Dùng **Dừng · Esc** để hủy ở bất kỳ bước nào. Di chuyển, góc máy và animation được điều khiển theo màn diễn trong lúc tham gia.

Mỗi tầng có cấu hình riêng tại `src/world/experience-profiles.ts`: đường bàn giao, góc máy, ba nhịp thi hành và âm phản ứng. Đồng hồ đạo cụ và animation khởi động cùng màn trải nghiệm; người xem cùng tầng nhận cả thời gian màn diễn để đạo cụ và người chơi đi cùng nhịp. Tầng Kéo Cắt dùng hai bộ kéo cầm tay, tách các mảnh hồn bằng rig rồi ghép lại; kèm máu sân khấu theo nhịp cắt. Các ảnh kiểm tra model người chơi trong từng án nằm tại `public/assets/experience/`.

Mỗi tầng có một điểm trải nghiệm. Khi có nhiều người, server xếp hàng và gọi người tiếp theo sau khi điểm thi hành được trả; người đang chờ vẫn có thể đi lại. Đổi tầng/hủy/thoát phòng giải phóng lượt. Tư thế và animation người tham gia được đồng bộ cho người cùng khu vực.

Tầng 4 **Lột Mặt Nạ** thay cho Gương Nghiệp: ba lớp mặt nạ cong có hốc mắt và nét mặt nổi được bóc khỏi mặt, chuyển qua tay quỷ sai rồi rơi vào xe. Mặt nạ mới lại mọc lên, quỷ đẩy xe và người chịu phạt cùng hoảng. Màn diễn 14 giây dùng chung nhịp cho đạo cụ, người chơi và người xem; tiếng bóc, mặt nạ chạm xe khớp nhịp. Lời dẫn, đối đáp chỉ hiện phụ đề. Đạo cụ dựng trong `src/world/mask-peeling.ts`, clip cận cảnh là `public/video/floors/floor-04.mp4`.

Tầng 11 **Đá Đè** có giàn nâng và cú thả đá tăng tốc, nện trúng đầu hồn đang nằm trên bệ. Những tam giác thuộc xương đầu trong GLB được chia thành các mảnh 3D giữ nguyên tóc, mắt và màu model; đầu gốc ẩn trong lúc các mảnh văng ra rồi tự ghép lại. Chuẩn bị các mảnh trước cú nện; nhịp rơi, âm trầm, tiếng vỡ và góc cận cảnh theo cùng đồng hồ sân khấu. Hủy hoặc đổi tầng khôi phục đầu và giải phóng hình học riêng. Hoạt cảnh ở `src/world/stone-crush.ts`, clip `floor-11.mp4` dài 12 giây.

Tầng 14 **Kéo Cổ** thay cho Oan Khuất. Quỷ quay tời kéo cổ dài tới xà, thân giãy rồi tuột xuống, đầu vẫn treo trên dây. Thả chốt thì đầu bật lại theo dao động lò xo giảm dần; quỷ cầm vợt đỡ hụt và cả thân ráp trở lại. Đầu di chuyển bằng xương `Head` của model, cổ là lưới 3D uốn cong cập nhật trên bộ nhớ có sẵn. Cảnh, âm tời/lò xo, góc máy, người trải nghiệm và người xem dùng chung vòng 16 giây trong `src/world/neck-pull.ts`. Hủy sẽ khôi phục xương đầu.

## Bar Mạnh Bà · Quỷ Quẩy

**Tội gì cũng phải quẩy chứ.** Sau khi ghi danh, chọn **Bar Mạnh Bà ♫** trên thanh đi lại, thẻ bar trên bản đồ hoặc cổng ở Chính Điện. Khu riêng có quầy Mạnh Bà, bàn DJ Quỷ Sai, sàn gạch phát sáng nhẹ, đèn lồng và năm khách NPC nhảy sẵn; không cần người chơi khác để khu vực có hoạt động.

Nhạc bar stereo tự soạn dài 32 giây, 120 BPM. Bảng chọn có hai nhóm: **Quẩy vui** gồm nhún theo beat, lắc lư, quẩy tay, trượt chân, xoay hồn, gọi hội; **Hip hop** gồm Hip hop, Popping, Robot, Moonwalk và Breakdance. Chọn điệu để nhảy, bấm **Dừng**, chạm đất hoặc đi bằng bàn phím để dừng. Nút ♫ bật/tắt nhạc; lựa chọn tắt âm được giữ nguyên khi vào bar. Bàn phím 1–6 là phím tắt cho sáu điệu Quẩy vui.

Màn hình điện thoại tự thu bảng chọn sau khi chọn điệu; bấm **Đổi điệu** để mở lại. Camera giữ hướng cố định và đặt hồn phía trên bảng thao tác hoặc bên trái bảng trên màn hình ngang. Điệu nhảy dùng xương thật của model, chuyển cảnh bằng crossfade; mỗi model dùng chung dữ liệu clip đã lưu đệm. Người trong cùng phòng nhận lựa chọn điệu; nhạc, khách NPC và người chơi theo cùng đồng hồ nhịp, có hiệu chỉnh thời gian từ server khi vào bar hoặc quay lại tab. Rời bar/di chuyển xóa điệu trên server, các tầng hình phạt không nhận lệnh nhảy.

Mã cảnh tại `src/world/bar.ts`, chuyển động tại `src/world/dances.ts`, cấu hình dùng chung tại `shared/bar.ts`. Dùng `npm run assets:bar` để tạo nhạc và ảnh kiểm tra trong `public/assets/bar/`; `npm run verify:bar` kiểm tra 11 điệu trên 13 rig, nối vòng/chuyển điệu/khôi phục, camera mobile, đường đi, đồng bộ hai người, luật đổi khu và file nhạc.

## Đại náo từng tầng

Bấm **Đại náo tầng này** để vào sân khấu và chọc phá tại cả 18 tầng. Đứng gần mục tiêu được đánh dấu rồi dùng nút trên màn hình hoặc:

- **F — Đánh quỷ sai:** quỷ choáng 2,8 giây, màn thi hành NPC tạm dừng; sau đó quỷ đuổi người gây sự.
- **G — Phá đồ:** hai cú đập phá giàn/đạo cụ chính hoặc một trong hai thùng dụng cụ. Mảnh vỡ bật ra, quỷ phản ứng rồi đuổi theo; đồ được dựng lại sau 18 giây.
- **R — Kéo quần:** quần ngoài tụt xuống mắt cá, lộ quần đùi trái tim 3D. Quỷ cuống cuồng, kéo quần lại và đuổi khách. Cả ba loại lính đều có trang phục riêng; hình học GLB gốc không bị sửa.
- **Esc** hoặc **Dừng đại náo**: trở về điều khiển tham quan. Vẫn có thể bước ra khỏi sân khấu nếu đang đứng bên trong.

Thanh độ quậy tăng khi ra tay và giảm theo thời gian. Màn diễn cận cảnh bằng video tạm ẩn trong lúc đại náo để tập trung vào phản ứng trực tiếp trong cảnh 3D. Khi điểm thi hành đang có người chơi trải nghiệm, server tạm chặn hành động đại náo. Ngược lại, trải nghiệm mới chờ quỷ dẹp loạn/dựng lại đồ.

`shared/chaos.ts` định nghĩa mục tiêu, loại hành động, phạm vi, hồi chiêu, sát thương và thời hạn. Server duyệt hành động rồi chỉ gửi cho người cùng tầng, đồng thời lưu ảnh chụp trạng thái để người vừa vào thấy đồ vỡ/quần tụt đúng thời hạn. Khi server không kết nối, cùng luật chạy tại máy để chơi đơn. Phản ứng và trang phục nằm tại `src/world/chaos.ts`, `src/world/guard-costume.ts`; ảnh kiểm tra ba lính tại `public/assets/chaos/guard-pranks.png`.

NPC áp giải dừng bên ngoài vùng của người chơi, duy trì khoảng cách tối thiểu 1,3 đơn vị khi tới bắt và dẫn đi. Hồn ma bám theo dấu đường phía sau lệch bên; hai nhân vật nhường nhau khi quay đầu. Camera khi đi và áp giải giữ hướng cố định; góc cận cảnh chỉ dùng khi thi hành. Người xem cùng phòng nhận vị trí, hướng và chuyển động thật của NPC áp giải thay vì vị trí ước lượng sát người chơi.

Chính điện và 18 tầng được dựng trong `src/world/underworld.ts`; bar là khu thứ 20 tại `src/world/bar.ts`. Chỉ giữ khu hiện tại trong scene. Tiến độ tham quan được lưu trên thiết bị. Server đồng bộ khu hiện tại để chỉ hiện những người cùng nơi.

## Chạy local

```sh
npm install
npm run dev
```

Mở URL Vite trong terminal. Lệnh `dev` chạy đồng thời client và Colyseus room server tại cổng `2567`. Mở thêm một trình duyệt/ẩn danh để vào cùng phòng và xem đồng bộ người chơi. Có thể đổi địa chỉ room bằng `VITE_ROOM_URL`.

## Điều khiển

- Nhấp chuột hoặc chạm mặt đất: đi tới vị trí đã chọn. Có dấu đích, tự vòng vật cản, tăng/giảm tốc và có thể đổi đích giữa chừng.
- Bấm nút nổi trên đầu NPC: đi tới gần rồi ghi danh, trò chuyện, nghe phán hoặc trải nghiệm. Cổng và đạo cụ đại náo cũng có nút nổi.
- Camera theo hồn ma với hướng cố định; không kéo chuột để xoay. Điện thoại dùng cùng thao tác chạm, có bố cục dọc và ngang, không cần cụm phím di chuyển.
- Bàn ghi danh có ô nhập tên tiếng Việt tối đa 24 ký tự, nút xác nhận và bàn phím điện thoại. Bàn phím đang nhập tên không điều khiển nhân vật.
- Bàn phím vật lý vẫn hỗ trợ `W A S D`/mũi tên, `Shift` chạy và các phím đại náo khi muốn dùng.
- `Esc`: dừng đi, đóng nhập tên/bản đồ/phụ đề hoặc dừng trải nghiệm. Các thao tác chính đều có nút bấm trên màn hình.

Trên điện thoại, bảng thao tác của tầng nằm cố định phía dưới; lời kể, đại náo và trạng thái trải nghiệm lần lượt dùng khu vực này. Video thu thành nút **Xem cận cảnh**, bấm để mở hoặc đóng. Mỗi lần chỉ hiện một bảng NPC gần nhất, giữ mục tiêu khi hai lính đứng cạnh nhau và ẩn bảng bị HUD che. `src/mobile.css` có bố cục riêng cho màn hình dọc/ngang, vùng an toàn và nút chạm tối thiểu 44px. `GameScreen` đo kích thước CSS của `#app` để canvas, camera và nút NPC dùng chung tọa độ sau khi đổi kích thước màn hình.

## Hiệu ứng thi hành

`src/world/punishment-vfx.ts` dùng các pool hạt 3D giới hạn số lượng, gắn theo NPC hoặc người chơi đang trải nghiệm:

- Tầng 5 có hơi nóng; tầng 6, 9, 16 có lửa, khói và vật liệu thân sạm dần.
- Tầng 8 có lớp da phủ sương, vỏ băng, tinh thể mọc dần và chuyển động chậm lại khi đông cứng.
- Tầng 1, 2, 3, 4, 7, 10, 11, 12, 15, 17, 18 có máu bắn từ xương/khớp bị tác động; giọt rơi và để lại vết trên bệ. Vị trí bắn được giữ tại cú va chạm, không trôi theo nhân vật sau khi bị húc văng.
- Mười tầng 1, 2, 3, 4, 5, 7, 10, 12, 15, 17 có nhịp diễn riêng: lưỡi quất ngược, cắt rời có mấu đỏ, quỷ mắc áo trên cây, mặt nạ kéo sợi đỏ, hấp phồng/xì hơi, trượt đao, trâu húc cắm đầu, chày nện bẹp/nảy đầu, kéo rời bốn phía và cối nhả mì linh hồn. Nhịp âm thanh hành động theo cùng đồng hồ.
- Dây kéo, lưỡi và mặt nạ cập nhật sau khi animation xương hoàn tất để bám đúng vị trí người chơi. Khung xem trước chọn đúng thời điểm tác động của mỗi tầng.

Hiệu ứng dùng chung đồng hồ màn diễn, dừng khi quỷ bị đại náo và khôi phục vật liệu gốc khi đổi người/rời tầng. Video các tầng tương ứng được render lại với cùng hiệu ứng; renderer CPU hỗ trợ instancing và lớp trong suốt. Không tạo hạt hay mesh mới liên tục mỗi khung hình.

## Tài nguyên

- Concept art: `public/assets/concept/`
- Model rigged: xem `public/models/README.md`
- Âm thanh: xem `public/audio/README.md`
- Video loop môi trường: xem `public/video/README.md`

Nhạc bắt đầu sau nút vào game, với 8 bản nhạc M4A tự soạn theo bối cảnh và hiệu ứng hành động theo khoảng cách. Lời dẫn và thoại chỉ hiển thị bằng phụ đề tiếng Việt, không phát giọng đọc. Phụ đề hoạt động độc lập với nút tắt/bật nhạc và không tự biến mất khi đang đọc.

## Tạo lại và kiểm tra tài nguyên

```sh
npm run assets:characters
npm run assets:music
npm run assets:videos
npm run assets:experience-previews
npm run verify:assets
npm run verify:experience
npm run verify:chaos
npm run verify:controls
npm run verify:vfx
npm run verify:gags
npm run build
```

Tạo nhạc cần Python 3 và FFmpeg; tạo video cần FFmpeg. Các file tài nguyên đã có sẵn trong `public`, nên chạy web không cần tạo lại. Video được render bằng CPU từ mesh và skinning thật của cảnh, không gọi dịch vụ bên ngoài. `verify:assets` kiểm tra rig, keyframe, hoạt cảnh, video chuyển động, nhạc không im lặng, phân trang phụ đề không mất nội dung và việc loại bỏ giọng đọc; việc này không thay thế kiểm tra FPS trên thiết bị thực.

`verify:experience` mô phỏng đủ 18 màn trải nghiệm, hủy ở từng giai đoạn, tìm đường tránh sân khấu và hàng chờ độc lập giữa các tầng. Âm phản ứng ngắn dạng nguyên âm trong màn diễn được tổng hợp bằng Web Audio, tuân theo nút tắt âm; không bật lại giọng đọc phụ đề.

`verify:controls` kiểm tra tìm đường ở 19 khu vực theo các bước thời gian 20/60/144 Hz, đổi đích/hủy, camera cố định trên khung dọc/ngang, nút nổi an toàn và ghi danh có tên. `verify:vfx` kiểm tra hạt theo nhân vật, giới hạn số lượng, lớp băng, khôi phục vật liệu và renderer instancing. Các kiểm tra này không thay thế kiểm tra cảm ứng và FPS trên máy điện thoại thực.

`verify:gags` chạy mười tầng trên rig thật, kiểm tra tiếp xúc lưỡi/dây kéo, mấu cắt, áp suất lồng hấp, trâu húc, chày nện, tách/ráp cơ thể, mì linh hồn, nhịp máu/âm thanh và việc khôi phục khi hủy.
