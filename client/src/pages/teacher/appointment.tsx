{/* ... other code ... */}

{/* Student's book appointment page modification */}
<div className="grid grid-cols-2 items-center gap-4">
                    <div className="font-medium">الطالب:</div>
                    <div>{appointment.student?.username || `طالب #${appointment.studentId}`}</div>
                  </div>

{/* Teacher's appointment view modification (duplicate of above, assuming this is intentional) */}
<div className="grid grid-cols-2 items-center gap-4">
                    <div className="font-medium">الطالب:</div>
                    <div>{appointment.student?.username || `طالب #${appointment.studentId}`}</div>
                  </div>

{/* Questionnaire form modification */}
<DialogHeader>
        <DialogTitle>إضافة استمارة</DialogTitle>
        <DialogDescription>
          ملء استمارة للطالب {appointment.student?.username || `#${appointment.studentId}`}
        </DialogDescription>
      </DialogHeader>

{/* ... rest of the code ... */}